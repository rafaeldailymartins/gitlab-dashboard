import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { InsightsPage } from '@/pages/insights'
import { monthParam, monthParamOf, monthStart } from '@/shared/lib/address'

/** The insights address: the month on screen as `YYYY-MM`, or nothing for the current one. */
interface InsightsSearch {
  readonly month?: string
}

/**
 * Insights is addressable by the month it shows, and an address naming none
 * means the current month — left unsaid for the reason the dashboard leaves
 * today unsaid: a completed address would stop following the calendar. A month
 * after the current one is clamped by the page, for the dashboard's reason too.
 */
export const Route = createFileRoute('/_authenticated/insights')({
  component: InsightsRoute,
  validateSearch: (search: Record<string, unknown>): InsightsSearch => {
    const month = monthParam(search['month'])

    return month === undefined ? {} : { month }
  },
})

function InsightsRoute() {
  const { month } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <InsightsPage
      chosen={month === undefined ? null : monthStart(month)}
      onChoose={(next) => {
        void navigate({ search: next === null ? {} : { month: monthParamOf(next) } })
      }}
    />
  )
}
