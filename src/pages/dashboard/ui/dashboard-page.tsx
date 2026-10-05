import { useNavigate } from '@tanstack/react-router'

import { usePreferences } from '@/entities/preferences'
import { ViewerGreeting } from '@/entities/viewers'
import { m, useActiveLocale } from '@/shared/i18n'
import { earlierOf, type IsoDate, toIsoDate } from '@/shared/lib/date'
import { formatFullDate } from '@/shared/lib/format'
import { SyncControl, useHoursReport, withheldNotices } from '@/widgets/hours-report'

import { DayControl } from './day-control'
import { DayFeed } from './day-feed'
import { KpiRow } from './kpi-row'
import { WeekStrip } from './week-strip'

interface DashboardPageProps {
  /** The day the address names, or null when it names none and today is meant. */
  readonly chosen: IsoDate | null
  /** Moves the screen to another day. Null is today, which the address leaves unsaid. */
  readonly onChoose: (day: IsoDate | null) => void
}

/**
 * The reader's own hours: the three periods that matter, the shape of their
 * week, and everything before it — as of today, or as of a day they chose.
 *
 * A day after today is read as today. Which day that is depends on the reader's
 * zone, which is why the clamp is here rather than where the address is parsed.
 */
export function DashboardPage({ chosen, onChoose }: DashboardPageProps) {
  const { preferences } = usePreferences()
  const { locale } = useActiveLocale()
  const navigate = useNavigate()

  const today = toIsoDate(new Date(), preferences.timeZone)
  const day = chosen === null ? today : earlierOf(chosen, today)
  const report = useHoursReport(day)
  const loading = !report.hasFigures

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
          <h1 className="text-2xl font-semibold tracking-tight">{formatFullDate(day, locale)}</h1>
        </div>
        <SyncControl notices={withheldNotices(report)} status={report} />
      </header>

      <DayControl
        day={day}
        onChoose={(next) => {
          onChoose(next >= today ? null : next)
        }}
        today={today}
      />

      <KpiRow
        day={day}
        dayTotal={report.day}
        loading={loading}
        month={report.month}
        today={today}
        week={report.week}
      />

      <WeekStrip
        day={day}
        days={report.days}
        loading={loading || !report.week.settled}
        onSelect={openDay}
        today={today}
      />

      <DayFeed
        appending={report.appending}
        days={report.days.filter((loaded) => loaded.date <= day)}
        empty={report.days.length === 0 ? m.day_feed_empty() : m.day_feed_empty_before()}
        loading={loading}
        onLoadOlder={report.loadOlder}
        reachedBeginning={report.complete}
      />
    </main>
  )
}
