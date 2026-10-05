import { type ReactNode, useId } from 'react'

import { usePreferences } from '@/entities/preferences'
import { m, useActiveLocale } from '@/shared/i18n'
import { earlierOf, endOfMonth, type IsoDate, startOfMonth, toIsoDate } from '@/shared/lib/date'
import { formatHours, formatMonth } from '@/shared/lib/format'
import { Skeleton } from '@/shared/ui/skeleton'
import { SyncControl, useHoursReport, withheldNotices } from '@/widgets/hours-report'

import { MonthControl } from './month-control'
import { MonthHeatmap } from './month-heatmap'
import { ProjectSplit } from './project-split'
import { TopItemsTable } from './top-items-table'

interface InsightsPageProps {
  /** The first day of the month the address names, or null for the current one. */
  readonly chosen: IsoDate | null
  /** Moves the screen to another month. Null is the current one, left unsaid. */
  readonly onChoose: (month: IsoDate | null) => void
}

/**
 * A month behind the dashboard: which days went unlogged, where the hours
 * went, and what took the most of them.
 *
 * Everything here reads the same cache entry the dashboard does, so arriving is
 * free; the figures are cut from the loaded days for the month on screen. A
 * month further back than what is loaded is read back to, and until it is the
 * screen waits rather than drawing unread days as days with nothing logged.
 */
export function InsightsPage({ chosen, onChoose }: InsightsPageProps) {
  const { preferences } = usePreferences()
  const { locale } = useActiveLocale()

  const thisMonth = startOfMonth(toIsoDate(new Date(), preferences.timeZone))
  const month = chosen === null ? thisMonth : earlierOf(startOfMonth(chosen), thisMonth)
  const report = useHoursReport(month)
  const days = report.days.filter((day) => day.date >= month && day.date <= endOfMonth(month))
  const hours = formatHours(report.month.hours, locale)
  // A total over a month not yet read back to is a floor, and the heatmap would
  // draw every unread working day as one with nothing logged.
  const ready = report.hasFigures && report.month.settled

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <div className="flex flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{formatMonth(month, locale)}</h1>
            {ready ? (
              <p className="text-sm text-muted-foreground">
                {month === thisMonth
                  ? m.insights_month_total({ hours })
                  : m.insights_month_total_past({ hours })}
              </p>
            ) : (
              <Skeleton className="h-5 w-48" />
            )}
          </div>
          <SyncControl notices={withheldNotices(report)} status={report} />
        </header>
        <MonthControl
          month={month}
          onChoose={(next) => {
            onChoose(next >= thisMonth ? null : next)
          }}
          thisMonth={thisMonth}
        />
      </div>

      {ready ? (
        <>
          <Section title={m.insights_month_title()}>
            <MonthHeatmap days={days} month={month} />
          </Section>
          <Section title={m.insights_projects_title()}>
            <ProjectSplit days={days} />
          </Section>
          <Section title={m.insights_items_title()}>
            <TopItemsTable days={days} />
          </Section>
        </>
      ) : (
        <Skeleton className="h-64 w-full" />
      )}
    </main>
  )
}

function Section({ children, title }: { readonly children: ReactNode; readonly title: string }) {
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground" id={headingId}>
        {title}
      </h2>
      <div className="rounded-lg border bg-card p-4">{children}</div>
    </section>
  )
}
