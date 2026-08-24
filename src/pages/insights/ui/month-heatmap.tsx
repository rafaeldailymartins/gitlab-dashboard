import type { DayTotal } from '@/entities/timelogs'

import { usePreferences } from '@/entities/preferences'
import { m, useActiveLocale } from '@/shared/i18n'
import { type IsoDate, WEEKDAYS } from '@/shared/lib/date'
import { formatFullDate, formatSpokenHours, shortWeekdayName } from '@/shared/lib/format'

import { type HeatCell, monthGrid } from '../lib/month-grid'

/**
 * Each band gets its own token from the validated ordinal ramp; an empty working
 * day gets the neutral one, so absence never reads as "a little".
 */
const BAND_CLASS = [
  'bg-chart-empty',
  'bg-chart-scale-1',
  'bg-chart-scale-2',
  'bg-chart-scale-3',
  'bg-chart-scale-4',
] as const

interface MonthHeatmapProps {
  readonly days: readonly DayTotal[]
  readonly month: IsoDate
}

/**
 * A month at a glance, one square per day.
 *
 * The point of the view is the gap: a working day with nothing logged is drawn
 * as an outlined empty square, distinct both from a day with time and from the
 * padding outside the month.
 */
export function MonthHeatmap({ days, month }: MonthHeatmapProps) {
  const { preferences } = usePreferences()
  const { locale } = useActiveLocale()
  const weeks = monthGrid(days, preferences.dailyTarget, month)

  return (
    <div className="mx-auto flex w-fit flex-col gap-1.5">
      <div className="grid grid-cols-[repeat(7,2.25rem)] gap-1.5">
        {WEEKDAYS.map((weekday) => (
          <span className="text-center text-xs text-muted-foreground" key={weekday}>
            {shortWeekdayName(weekday, locale)}
          </span>
        ))}
      </div>
      {weeks.map((week, index) => (
        <div
          className="grid grid-cols-[repeat(7,2.25rem)] gap-1.5"
          key={week.at(0)?.date ?? `week-${String(index)}`}
        >
          {week.map((cell, position) => (
            <Cell
              cell={cell}
              key={cell.date ?? `pad-${String(index)}-${String(position)}`}
              locale={locale}
            />
          ))}
        </div>
      ))}
      <Legend />
    </div>
  )
}

function Cell({ cell, locale }: { readonly cell: HeatCell; readonly locale: string }) {
  if (!cell.date) {
    return <span aria-hidden className="aspect-square rounded-sm" />
  }

  return (
    <span
      className={`aspect-square rounded-sm ${BAND_CLASS[cell.band]} ${
        cell.band === 0 && cell.isWorkingDay ? 'border border-dashed border-chart-target' : ''
      }`}
      title={`${formatFullDate(cell.date, locale)}: ${formatSpokenHours(cell.hours, locale)}`}
    >
      <span className="sr-only">
        {`${formatFullDate(cell.date, locale)}: ${formatSpokenHours(cell.hours, locale)}`}
        {cell.band === 0 && cell.isWorkingDay ? ` — ${m.insights_working_day_empty()}` : ''}
      </span>
    </span>
  )
}

/** The key to the ramp: four bands, and the outline that means nothing logged. */
function Legend() {
  return (
    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <span aria-hidden className="size-3 rounded-sm border border-dashed border-chart-target" />
        {m.insights_legend_empty()}
      </span>
      <span className="ml-auto flex items-center gap-1">
        {m.insights_legend_less()}
        {BAND_CLASS.slice(1).map((band) => (
          <span aria-hidden className={`size-3 rounded-sm ${band}`} key={band} />
        ))}
        {m.insights_legend_more()}
      </span>
    </div>
  )
}
