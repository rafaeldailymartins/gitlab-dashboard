import { createFileRoute } from '@tanstack/react-router'

import { DayDetailPage } from '@/pages/day-detail'
import { isoDate } from '@/shared/lib/date'

/**
 * A day is addressable, so a reader can link to one or reload it.
 *
 * The date is validated here rather than inside the page: an address is untrusted
 * input, and `isoDate` is the one place a string becomes a calendar day.
 */
export const Route = createFileRoute('/_authenticated/days/$date')({
  component: DayDetailRoute,
})

function DayDetailRoute() {
  const { date } = Route.useParams()

  return <DayDetailPage date={isoDate(date)} />
}
