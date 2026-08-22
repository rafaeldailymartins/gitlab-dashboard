import { createFileRoute } from '@tanstack/react-router'

import {
  targetForDate,
  targetForDates,
  targetProgress,
  usePreferences,
} from '@/entities/preferences'
import { secondsToHours } from '@/entities/timelogs'
import { m, useActiveLocale } from '@/shared/i18n'
import { addDays, datesBetween, startOfWeek, toIsoDate } from '@/shared/lib/date'
import { formatFullDate, formatHours } from '@/shared/lib/format'

export const Route = createFileRoute('/')({ component: DashboardRoute })

/**
 * Placeholder dashboard.
 *
 * It shows the reader's own schedule so the settings are visibly connected to
 * something, and it runs the same conversion the real figures will — with no
 * timelogs fetched yet, so today reads as zero. The week strip, KPI row and day
 * feed replace it once sign-in and the report land.
 */
function DashboardRoute() {
  const { preferences } = usePreferences()
  const { locale } = useActiveLocale()

  const today = toIsoDate(new Date(), preferences.timeZone)
  const week = datesBetween(startOfWeek(today), addDays(startOfWeek(today), 6))

  const loggedToday = secondsToHours(0)
  const progress = targetProgress(loggedToday, targetForDate(preferences.dailyTarget, today))
  const weekTarget = targetForDates(preferences.dailyTarget, week)

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{formatFullDate(today, locale)}</h1>
        <p className="text-sm text-muted-foreground">{m.dashboard_placeholder_notice()}</p>
      </header>

      <dl className="grid gap-4 sm:grid-cols-2">
        <Figure
          detail={
            progress.targetHours > 0
              ? m.dashboard_of_target({ target: formatHours(progress.targetHours, locale) })
              : m.dashboard_no_target()
          }
          label={m.dashboard_today()}
          value={formatHours(progress.loggedHours, locale)}
        />
        <Figure
          detail={m.dashboard_of_target({ target: formatHours(weekTarget, locale) })}
          label={m.dashboard_this_week()}
          value={formatHours(0, locale)}
        />
      </dl>
    </main>
  )
}

function Figure({
  detail,
  label,
  value,
}: {
  readonly detail: string
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-1.5">
        <span className="tabular text-3xl font-semibold">{value}</span>
        <span className="text-sm text-muted-foreground">{m.hours_short()}</span>
        <span className="ml-1 text-xs text-muted-foreground">{detail}</span>
      </dd>
    </div>
  )
}
