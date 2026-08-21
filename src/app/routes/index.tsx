import { createFileRoute } from '@tanstack/react-router'

import { secondsToHours } from '@/entities/timelog'
import { m } from '@/shared/i18n'

export const Route = createFileRoute('/')({ component: DashboardRoute })

/**
 * Placeholder dashboard. It exists so the scaffold has one route wired all the
 * way from the router down to the timelog domain; the real week strip, KPI row
 * and day feed replace it in the dashboard phase.
 */
function DashboardRoute() {
  const hours = secondsToHours(24_120)

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-2 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">{m.app_name()}</h1>
      <p className="tabular text-muted-foreground">{hours}</p>
    </main>
  )
}
