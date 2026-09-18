import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import type { SuggestedMember } from '@/entities/team-timelogs'

import {
  suggestionsFrom,
  teamSuggestionsQuery,
  useTeamTimelogGateway,
} from '@/entities/team-timelogs'
import { addDays, type IsoDate, spanInstantsIn, toIsoDate } from '@/shared/lib/date'

/**
 * How far back the suggestions look.
 *
 * Long enough to catch somebody who was away for a sprint, short enough that a
 * squad's shape a quarter ago is not offered as its shape now. It is stated on
 * screen, because a list of names with no window behind it invites the reader to
 * read it as the team's membership.
 */
const WINDOW_DAYS = 90

export interface Suggestions {
  readonly loading: boolean
  /** True when the reading stopped at its cap before the group ran out. */
  readonly partial: boolean
  readonly people: readonly SuggestedMember[]
  /** The first day the window covers, for the sentence that states it. */
  readonly since: IsoDate
}

/**
 * Whoever logged time in a group over the last ninety days.
 *
 * Whoever logged, not whoever is a member. A group's membership is an
 * access-control list: measured on one real squad it offered seventeen names of
 * which eleven had no hours at all, while two people who had logged were not on
 * it. The price is a paged read where a membership list cost one page, and that
 * is the honest price of suggesting the right people.
 *
 * Exact instants, so none of the report's widen-then-cut discipline applies:
 * this window is not a month and has no day boundary anybody could round.
 */
export function useSuggestions(fullPath: string, timeZone: string): Suggestions {
  const gateway = useTeamTimelogGateway()
  const today = toIsoDate(new Date(), timeZone)
  const since = addDays(today, -WINDOW_DAYS)
  const window = useMemo(
    () => ({ ...spanInstantsIn(since, today, timeZone), fullPath }),
    [since, today, fullPath, timeZone],
  )
  const answer = useQuery({
    ...teamSuggestionsQuery(gateway, window),
    enabled: fullPath !== '',
  })

  return {
    loading: answer.isFetching,
    partial: answer.data?.partial ?? false,
    people: useMemo(() => suggestionsFrom(answer.data?.people ?? []), [answer.data]),
    since,
  }
}
