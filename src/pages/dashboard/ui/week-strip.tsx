import { useId } from 'react'

import type { DayTotal } from '@/entities/timelogs'

import { usePreferences } from '@/entities/preferences'
import { m, useActiveLocale } from '@/shared/i18n'
import { type IsoDate, startOfWeek } from '@/shared/lib/date'
import { formatShortDate } from '@/shared/lib/format'
import { Skeleton } from '@/shared/ui/skeleton'

import { weekDays } from '../lib/week-days'
import { DayBar } from './day-bar'

interface WeekStripProps {
  /** Any day of the week to draw. */
  readonly day: IsoDate
  readonly days: readonly DayTotal[]
  /**
   * True until the week has been read, when empty bars would be a claim — both
   * before anything has loaded and while a week the reader chose further back
   * is still being reached.
   */
  readonly loading: boolean
  readonly onSelect: (date: IsoDate) => void
  readonly today: IsoDate
}

/**
 * The seven days of a week, each a bar against its own target.
 *
 * It answers "how is the week going" at a glance and, just as importantly,
 * "which day did I forget to log". Every bar is also a button: the shape is the
 * quick read, the day detail is one click away.
 */
export function WeekStrip({ day, days, loading, onSelect, today }: WeekStripProps) {
  const { preferences } = usePreferences()
  const { locale } = useActiveLocale()
  const headingId = useId()
  const week = weekDays(days, preferences.dailyTarget, { day, today })
  const weekStart = startOfWeek(day)

  return (
    <section aria-labelledby={headingId} className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-medium text-muted-foreground" id={headingId}>
        {weekStart === startOfWeek(today)
          ? m.week_strip_title()
          : m.dashboard_week_of({ date: formatShortDate(weekStart, locale) })}
      </h2>
      {loading ? (
        <Skeleton className="mt-4 h-28 w-full" />
      ) : (
        <ol className="mt-4 flex h-28 items-end gap-1.5 sm:gap-2">
          {week.map((column) => (
            <DayBar day={column} key={column.date} onSelect={onSelect} />
          ))}
        </ol>
      )}
    </section>
  )
}
