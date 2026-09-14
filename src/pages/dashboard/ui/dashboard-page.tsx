import { useNavigate } from '@tanstack/react-router'

import { usePreferences } from '@/entities/preferences'
import { ViewerGreeting } from '@/entities/viewers'
import { useActiveLocale } from '@/shared/i18n'
import { type IsoDate, toIsoDate } from '@/shared/lib/date'
import { formatFullDate } from '@/shared/lib/format'
import { SyncControl, useHoursReport, withheldNotices } from '@/widgets/hours-report'

import { DayFeed } from './day-feed'
import { KpiRow } from './kpi-row'
import { WeekStrip } from './week-strip'

/**
 * The reader's own hours: the three periods that matter, the shape of this week,
 * and everything before it.
 */
export function DashboardPage() {
  const { preferences } = usePreferences()
  const { locale } = useActiveLocale()
  const navigate = useNavigate()
  const report = useHoursReport()

  const today = toIsoDate(new Date(), preferences.timeZone)
  const openDay = (date: IsoDate): void => {
    void navigate({ params: { date }, to: '/days/$date' })
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      {/* The sync control is pinned to the end of the row and wraps under the
          date on a narrow screen, where `items-end` keeps it on the date's
          baseline rather than floating beside the greeting. */}
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex flex-col gap-1">
          <ViewerGreeting />
          <h1 className="text-2xl font-semibold tracking-tight">{formatFullDate(today, locale)}</h1>
        </div>
        <SyncControl notices={withheldNotices(report)} status={report} />
      </header>

      <KpiRow
        loading={!report.hasFigures}
        month={report.month}
        today={today}
        todayTotal={report.today}
        week={report.week}
      />

      <WeekStrip days={report.days} loading={!report.hasFigures} onSelect={openDay} today={today} />

      <DayFeed
        appending={report.appending}
        days={report.days}
        loading={!report.hasFigures}
        onLoadOlder={report.loadOlder}
        reachedBeginning={report.complete}
      />
    </main>
  )
}
