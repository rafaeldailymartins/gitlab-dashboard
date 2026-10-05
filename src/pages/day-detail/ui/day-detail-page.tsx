import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { targetForDate, targetProgress, usePreferences } from '@/entities/preferences'
import { m, useActiveLocale } from '@/shared/i18n'
import { type IsoDate, weekdayOf } from '@/shared/lib/date'
import { formatHours, formatLongDate, weekdayName } from '@/shared/lib/format'
import { HourFigure } from '@/shared/ui/hour-figure'
import { Skeleton } from '@/shared/ui/skeleton'
import { SyncControl, useHoursReport, withheldNotices } from '@/widgets/hours-report'

import { WorkItemList } from './work-item-list'

/**
 * One day, addressable by URL.
 *
 * It reads from the same cache entry as the dashboard, so arriving here from the
 * week strip costs no request. Reloading the address does: the whole history is
 * fetched newest first and this day is cut out of it, which is also what makes a
 * day with nothing logged answerable rather than merely empty. A day older than
 * the first page is read back to, and shown as loading until it is: before
 * then, nothing loaded for it is not the same as nothing logged.
 */
export function DayDetailPage({ date }: { readonly date: IsoDate }) {
  const { locale } = useActiveLocale()
  const { preferences } = usePreferences()
  const report = useHoursReport(date)

  const day = report.days.find((loaded) => loaded.date === date)
  const target = targetForDate(preferences.dailyTarget, date)
  const progress = targetProgress(day?.hours ?? 0, target)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <Link
        className="flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        to="/"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {m.day_detail_back()}
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{formatLongDate(date, locale)}</h1>
          <p className="text-sm text-muted-foreground">{weekdayName(weekdayOf(date), locale)}</p>
        </div>
        <SyncControl notices={withheldNotices(report)} status={report} />
      </header>

      {report.hasFigures && report.day.settled ? (
        <>
          <p className="flex items-baseline gap-1.5">
            <HourFigure
              className="tabular text-3xl font-semibold"
              hours={progress.loggedHours}
              unitClassName="text-sm text-muted-foreground"
            />
            <span className="ml-1 text-xs text-muted-foreground">
              {target > 0
                ? m.dashboard_of_target({ target: formatHours(target, locale) })
                : m.dashboard_no_target()}
            </span>
          </p>
          <WorkItemList items={day?.items ?? []} />
        </>
      ) : (
        <Skeleton className="h-24 w-full" />
      )}
    </main>
  )
}
