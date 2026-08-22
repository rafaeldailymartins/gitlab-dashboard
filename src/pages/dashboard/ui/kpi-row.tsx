import type { PeriodSummary } from '@/entities/timelogs'

import { type DailyTarget, targetForDates, usePreferences } from '@/entities/preferences'
import { m } from '@/shared/i18n'
import {
  addDays,
  datesBetween,
  endOfMonth,
  type IsoDate,
  startOfMonth,
  startOfWeek,
} from '@/shared/lib/date'

import { PeriodFigure } from './period-figure'

const LAST_DAY_OF_WEEK = 6

interface KpiRowProps {
  /** True before anything has loaded, when zero would be a guess. */
  readonly loading: boolean
  readonly month: PeriodSummary
  readonly today: IsoDate
  readonly todayTotal: PeriodSummary
  readonly week: PeriodSummary
}

/**
 * Today, this week and this month, each against the target the reader set.
 *
 * The three periods are the whole point of the screen, so they sit above
 * everything else and are the first thing the newest page answers.
 */
export function KpiRow({ loading, month, today, todayTotal, week }: KpiRowProps) {
  const { preferences } = usePreferences()
  const targets = targetsFor(preferences.dailyTarget, today)

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <PeriodFigure
        label={m.dashboard_today()}
        summary={todayTotal}
        target={targets.today}
        waiting={loading}
      />
      <PeriodFigure
        label={m.dashboard_this_week()}
        summary={week}
        target={targets.week}
        waiting={loading}
      />
      <PeriodFigure
        label={m.dashboard_this_month()}
        summary={month}
        target={targets.month}
        waiting={loading}
      />
    </div>
  )
}

function targetsFor(dailyTarget: DailyTarget, today: IsoDate) {
  const weekStart = startOfWeek(today)

  return {
    month: targetForDates(dailyTarget, datesBetween(startOfMonth(today), endOfMonth(today))),
    today: targetForDates(dailyTarget, [today]),
    week: targetForDates(
      dailyTarget,
      datesBetween(weekStart, addDays(weekStart, LAST_DAY_OF_WEEK)),
    ),
  }
}
