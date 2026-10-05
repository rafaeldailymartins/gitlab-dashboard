import type { PeriodSummary } from '@/entities/timelogs'

import { type DailyTarget, targetForDates, usePreferences } from '@/entities/preferences'
import { m, useActiveLocale } from '@/shared/i18n'
import {
  addDays,
  datesBetween,
  endOfMonth,
  type IsoDate,
  startOfMonth,
  startOfWeek,
} from '@/shared/lib/date'
import { formatMonth, formatShortDate } from '@/shared/lib/format'

import { PeriodFigure } from './period-figure'

const LAST_DAY_OF_WEEK = 6

interface KpiRowProps {
  /** The day the dashboard is read as of. */
  readonly day: IsoDate
  readonly dayTotal: PeriodSummary
  /** True before anything has loaded, when zero would be a guess. */
  readonly loading: boolean
  readonly month: PeriodSummary
  readonly today: IsoDate
  readonly week: PeriodSummary
}

/**
 * The day, its week and its month, each against the target the reader set.
 *
 * The three periods are the whole point of the screen, so they sit above
 * everything else and are the first thing the newest page answers.
 */
export function KpiRow({ day, dayTotal, loading, month, today, week }: KpiRowProps) {
  const { preferences } = usePreferences()
  const { locale } = useActiveLocale()
  const targets = targetsFor(preferences.dailyTarget, day)
  const labels = labelsFor(day, today, locale)

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <PeriodFigure label={labels.day} summary={dayTotal} target={targets.day} waiting={loading} />
      <PeriodFigure label={labels.week} summary={week} target={targets.week} waiting={loading} />
      <PeriodFigure label={labels.month} summary={month} target={targets.month} waiting={loading} />
    </div>
  )
}

/**
 * What each figure is called.
 *
 * "This week" over a week in August would be false, and a bare "Week" would
 * send the reader up to the heading to learn which one — so a period that does
 * not hold today is named by the dates it covers.
 */
function labelsFor(day: IsoDate, today: IsoDate, locale: string) {
  const weekStart = startOfWeek(day)

  return {
    day: day === today ? m.dashboard_today() : formatShortDate(day, locale),
    month:
      startOfMonth(day) === startOfMonth(today)
        ? m.dashboard_this_month()
        : formatMonth(day, locale),
    week:
      weekStart === startOfWeek(today)
        ? m.dashboard_this_week()
        : m.dashboard_week_of({ date: formatShortDate(weekStart, locale) }),
  }
}

function targetsFor(dailyTarget: DailyTarget, day: IsoDate) {
  const weekStart = startOfWeek(day)

  return {
    day: targetForDates(dailyTarget, [day]),
    month: targetForDates(dailyTarget, datesBetween(startOfMonth(day), endOfMonth(day))),
    week: targetForDates(
      dailyTarget,
      datesBetween(weekStart, addDays(weekStart, LAST_DAY_OF_WEEK)),
    ),
  }
}
