import { targetForDate, targetForDates, usePreferences } from '@/entities/preferences'
import { m, useActiveLocale } from '@/shared/i18n'
import {
  addDays,
  datesBetween,
  endOfMonth,
  startOfMonth,
  startOfWeek,
  toIsoDate,
} from '@/shared/lib/date'
import { formatFullDate } from '@/shared/lib/format'

import { useHoursReport } from '../lib/use-hours-report'
import { PeriodFigure } from './period-figure'
import { ReportNotice } from './report-notice'

const LAST_DAY_OF_WEEK = 6

/**
 * The reader's own hours: today, this week, this month.
 *
 * The week strip and the day feed land on top of this in the next step; what is
 * here already reads real timelogs, in the reader's own time zone, against the
 * targets they configured.
 */
export function DashboardPage() {
  const { preferences } = usePreferences()
  const { locale } = useActiveLocale()
  const report = useHoursReport()

  const today = toIsoDate(new Date(), preferences.timeZone)
  const weekStart = startOfWeek(today)
  const { dailyTarget } = preferences

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{formatFullDate(today, locale)}</h1>
        <ReportNotice report={report} />
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <PeriodFigure
          label={m.dashboard_today()}
          summary={report.today}
          target={targetForDate(dailyTarget, today)}
          waiting={!report.hasFigures}
        />
        <PeriodFigure
          label={m.dashboard_this_week()}
          summary={report.week}
          target={targetForDates(
            dailyTarget,
            datesBetween(weekStart, addDays(weekStart, LAST_DAY_OF_WEEK)),
          )}
          waiting={!report.hasFigures}
        />
        <PeriodFigure
          label={m.dashboard_this_month()}
          summary={report.month}
          target={targetForDates(dailyTarget, datesBetween(startOfMonth(today), endOfMonth(today)))}
          waiting={!report.hasFigures}
        />
      </div>
    </main>
  )
}
