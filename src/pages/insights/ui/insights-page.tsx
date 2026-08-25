import { type ReactNode, useId } from 'react'

import { usePreferences } from '@/entities/preferences'
import { m, useActiveLocale } from '@/shared/i18n'
import { endOfMonth, startOfMonth, toIsoDate } from '@/shared/lib/date'
import { formatHours, formatMonth } from '@/shared/lib/format'
import { Skeleton } from '@/shared/ui/skeleton'
import { SyncControl, useHoursReport } from '@/widgets/hours-report'

import { MonthHeatmap } from './month-heatmap'
import { ProjectSplit } from './project-split'
import { TopItemsTable } from './top-items-table'

/**
 * The month behind the dashboard: which days went unlogged, where the hours
 * went, and what took the most of them.
 *
 * Everything here reads the same cache entry the dashboard does, so arriving is
 * free; the figures are cut from the loaded days for the current month.
 */
export function InsightsPage() {
  const { preferences } = usePreferences()
  const { locale } = useActiveLocale()
  const report = useHoursReport()

  const today = toIsoDate(new Date(), preferences.timeZone)
  const month = { from: startOfMonth(today), to: endOfMonth(today) }
  const days = report.days.filter((day) => day.date >= month.from && day.date <= month.to)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{formatMonth(today, locale)}</h1>
          <p className="text-sm text-muted-foreground">
            {m.insights_month_total({ hours: formatHours(report.month.hours, locale) })}
          </p>
        </div>
        <SyncControl report={report} />
      </header>

      {report.hasFigures ? (
        <>
          <Section title={m.insights_month_title()}>
            <MonthHeatmap days={days} month={today} />
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
