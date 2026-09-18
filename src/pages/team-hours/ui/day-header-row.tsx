import type { Granularity, GridColumn } from '@/entities/team-timelogs'

import { m, useActiveLocale } from '@/shared/i18n'
import { type IsoDate, isoWeekOf, weekdayOf } from '@/shared/lib/date'
import { formatDayWithWeekday, formatShortDate, shortWeekdayName } from '@/shared/lib/format'

import type { ColumnMarks } from '../lib/marks'

import { dividerFor } from '../lib/marks'

const HEAD = 'sticky top-7 z-20 h-10 border-b border-border bg-card p-0 align-middle font-medium'

/** A column nothing is expected of carries the same tint as its cells. */
const TINTED = 'bg-chart-empty'

interface DayHeaderRowProps {
  readonly columns: readonly GridColumn[]
  readonly granularity: Granularity
  readonly marks: ColumnMarks
  readonly today: IsoDate
}

/**
 * The second header row: one heading per column.
 *
 * The digits and the abbreviation are hidden from assistive technology and the
 * spoken form sits beside them — the pattern `MonthHeatmap` uses, and for the
 * same reason: `aria-label` is ignored on a generic element while Testing
 * Library computes it anyway, so a label there passes a green suite over a
 * heading no screen reader ever reads.
 *
 * Today is marked with `aria-current`, which is the same fact the filled chip
 * carries visually.
 */
export function DayHeaderRow({ columns, granularity, marks, today }: DayHeaderRowProps) {
  const { locale } = useActiveLocale()

  return (
    <tr>
      {columns.map((column, index) => (
        <th
          className={`${HEAD} ${column.referenceHours === 0 ? TINTED : ''} ${dividerFor(column.key, marks, index === columns.length - 1)}`}
          key={column.key}
          scope="col"
          {...(column.from === today ? { 'aria-current': 'date' as const } : {})}
        >
          {granularity === 'days' ? (
            <DayHeading column={column} locale={locale} today={today} />
          ) : (
            <WeekHeading column={column} locale={locale} />
          )}
        </th>
      ))}
    </tr>
  )
}

function DayHeading({
  column,
  locale,
  today,
}: {
  readonly column: GridColumn
  readonly locale: string
  readonly today: IsoDate
}) {
  const isToday = column.from === today

  return (
    <span className="flex flex-col items-center gap-px leading-none">
      <span
        aria-hidden
        className={
          column.referenceHours === 0 ? 'tabular text-xs text-muted-foreground' : 'tabular text-xs'
        }
      >
        {Number(column.from.slice(-2))}
      </span>
      {/* A column nobody is expected to log in is half as wide as the others,
          which is not room for an abbreviation — and the tint and the number
          already say which day it is. */}
      {column.referenceHours === 0 ? null : (
        <span
          aria-hidden
          className={
            isToday
              ? 'rounded-sm bg-primary px-1 text-[10px] text-primary-foreground'
              : 'px-1 text-[10px] text-muted-foreground'
          }
        >
          {shortWeekdayName(weekdayOf(column.from), locale)}
        </span>
      )}
      <span className="sr-only">{formatDayWithWeekday(column.from, locale)}</span>
    </span>
  )
}

function WeekHeading({ column, locale }: { readonly column: GridColumn; readonly locale: string }) {
  const span = `${formatShortDate(column.from, locale)}–${formatShortDate(column.to, locale)}`

  return (
    <span className="flex flex-col items-center gap-px leading-none">
      <span aria-hidden className="text-xs">
        {m.team_week_number({ week: isoWeekOf(column.from) })}
      </span>
      <span aria-hidden className="text-[10px] text-muted-foreground">
        {span}
      </span>
      <span className="sr-only">{span}</span>
    </span>
  )
}
