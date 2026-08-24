import { useId } from 'react'

import type { DayTotal } from '@/entities/timelogs'
import type { IsoDate } from '@/shared/lib/date'

import { usePreferences } from '@/entities/preferences'
import { m } from '@/shared/i18n'
import { Skeleton } from '@/shared/ui/skeleton'

import { weekDays } from '../lib/week-days'
import { DayBar } from './day-bar'

interface WeekStripProps {
  readonly days: readonly DayTotal[]
  /** True before anything has loaded, when empty bars would be a claim. */
  readonly loading: boolean
  readonly onSelect: (date: IsoDate) => void
  readonly today: IsoDate
}

/**
 * The seven days of this week, each a bar against its own target.
 *
 * It answers "how is the week going" at a glance and, just as importantly,
 * "which day did I forget to log". Every bar is also a button: the shape is the
 * quick read, the day detail is one click away.
 */
export function WeekStrip({ days, loading, onSelect, today }: WeekStripProps) {
  const { preferences } = usePreferences()
  const headingId = useId()
  const week = weekDays(days, preferences.dailyTarget, today)

  return (
    <section aria-labelledby={headingId} className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-medium text-muted-foreground" id={headingId}>
        {m.week_strip_title()}
      </h2>
      {loading ? (
        <Skeleton className="mt-4 h-28 w-full" />
      ) : (
        <ol className="mt-4 flex h-28 items-end gap-1.5 sm:gap-2">
          {week.map((day) => (
            <DayBar day={day} key={day.date} onSelect={onSelect} />
          ))}
        </ol>
      )}
    </section>
  )
}
