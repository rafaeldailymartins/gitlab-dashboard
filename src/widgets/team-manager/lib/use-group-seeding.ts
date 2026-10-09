import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

import type { TeamMember } from '@/entities/teams'

import { usePreferences } from '@/entities/preferences'
import {
  suggestionsFrom,
  teamSuggestionsQuery,
  useTeamTimelogGateway,
} from '@/entities/team-timelogs'
import { addDays, spanInstantsIn, toIsoDate } from '@/shared/lib/date'

/**
 * How far back the people a team is built from are read.
 *
 * Thirty days, cut from ninety, and the cut is the point rather than a detail.
 * The read is strictly sequential — each page needs the last page's cursor — so
 * the window multiplies directly into how long somebody waits looking at
 * nothing. A quarter of a year of a busy group is a thousand entries read to
 * learn a dozen names.
 *
 * What thirty days loses is somebody who was away for the whole month, and that
 * is a trade made knowingly: they are one search away by name, and the
 * alternative was every reader paying for the rare one every time they build a
 * team.
 *
 * The number is no longer said out loud, and that changed with what a group is
 * for. It used to seed a list of candidates the reader picked from, where the
 * window was the difference between "nobody logged here" and "nobody logged here
 * lately"; a group is a template now, and what the reader is looking at a second
 * later is the team itself, with everybody on it and a search that reaches
 * anybody who is not.
 */
const WINDOW_DAYS = 30

export interface Seeding {
  /** The path of the group being read, or null when none is. */
  readonly busy: null | string
  /** Reads a group and answers with the people a team from it would carry. */
  readonly read: (fullPath: string) => Promise<readonly TeamMember[]>
}

/**
 * Who a team built from a group would carry.
 *
 * Imperative rather than a query the component renders from, because this is an
 * answer to a click and not a fact about what is on screen. A rendered query
 * would have to write the team from an effect when its data changed — which is
 * an effect that writes to a store, fires again on every cache touch, and has to
 * remember whether it already did.
 *
 * It still goes through the query client, so a reader who builds two teams from
 * the same group in one sitting pays for one read, and an in-flight read is
 * shared rather than doubled.
 *
 * `SuggestionAnswer.partial` is deliberately not carried past here. The adapter
 * still reports it and is still tested on it — it is a true fact about the read
 * — but nothing on screen says it any more: a census that might be short matters
 * when the list *is* the answer, and this list is a starting point the reader is
 * already looking at and editing.
 *
 * Exact instants, so none of the report's widen-then-cut discipline applies:
 * this window is not a month and has no day boundary anybody could round.
 */
export function useGroupSeeding(): Seeding {
  const client = useQueryClient()
  const gateway = useTeamTimelogGateway()
  const { preferences } = usePreferences()
  const { timeZone } = preferences
  const [busy, setBusy] = useState<null | string>(null)

  const read = useCallback(
    async (fullPath: string): Promise<readonly TeamMember[]> => {
      const today = toIsoDate(new Date(), timeZone)
      const window = {
        ...spanInstantsIn(addDays(today, -WINDOW_DAYS), today, timeZone),
        fullPath,
      }

      setBusy(fullPath)

      try {
        const answer = await client.query(teamSuggestionsQuery(gateway, window))

        return suggestionsFrom(answer.people).map((one) => memberOf(one.person))
      } finally {
        setBusy(null)
      }
    },
    [client, gateway, timeZone],
  )

  return { busy, read }
}

/**
 * A candidate, as the team stores one.
 *
 * `webUrl` is dropped: it is derivable from the username and the instance, and
 * storing it would put a second source of truth for the host in the document.
 */
function memberOf(person: { id: string; name: string; username: string }): TeamMember {
  return { id: person.id, name: person.name, username: person.username }
}
