import { createFileRoute, useNavigate } from '@tanstack/react-router'

import type { IsoDate } from '@/shared/lib/date'

import { DashboardPage } from '@/pages/dashboard'
import { dayParam } from '@/shared/lib/address'

/** The dashboard's address: the day it is read as of, or nothing for today. */
interface DashboardSearch {
  readonly date?: IsoDate
}

/**
 * The dashboard is addressable by the day it is read as of.
 *
 * An address naming no day is left that way rather than completed with today's
 * date: absence means today, and keeps meaning it after midnight, where a
 * completed address would freeze a bookmark on the day it was saved. The page
 * hands back null for today for the same reason, so "now" has one address.
 *
 * A day after today is kept here and clamped by the page, because which day is
 * today depends on the reader's zone, and that is only known inside React.
 */
export const Route = createFileRoute('/_authenticated/')({
  component: DashboardRoute,
  validateSearch: (search: Record<string, unknown>): DashboardSearch => {
    const date = dayParam(search['date'])

    return date === undefined ? {} : { date }
  },
})

function DashboardRoute() {
  const { date } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <DashboardPage
      chosen={date ?? null}
      onChoose={(day) => {
        void navigate({ search: day === null ? {} : { date: day } })
      }}
    />
  )
}
