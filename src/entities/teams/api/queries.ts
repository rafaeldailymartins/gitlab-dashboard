import { queryOptions } from '@tanstack/react-query'

import type { TeamsGateway } from '../model/ports'

/**
 * A reader's teams are a list of colleagues, and must not reach the device.
 *
 * The same rule the hours carry, for the same reason and by the same route: the
 * persister reads this rather than a key it has to recognise, so nothing else
 * has to know the rule exists. A shared or borrowed machine keeps no part of
 * somebody else's team.
 *
 * The cost is a picker that is empty until the store answers, and it is small:
 * this screen asks the provider before it draws a figure anyway.
 */
const NOT_PERSISTED = { persist: false }

export const TEAMS_KEY = ['teams'] as const

const MINUTE = 60 * 1000

/**
 * The reader's own teams, which nobody else can change.
 *
 * Long-lived on purpose: a team changes when this reader changes it, and every
 * edit writes the answer straight back into the cache. Refetching on focus
 * would spend a request per tab switch to learn what this tab already knows.
 */
export function teamsQuery(gateway: TeamsGateway) {
  return queryOptions({
    gcTime: 30 * MINUTE,
    meta: NOT_PERSISTED,
    queryFn: ({ signal }) => gateway.read(signal),
    queryKey: TEAMS_KEY,
    refetchOnWindowFocus: false,
    staleTime: 5 * MINUTE,
  })
}
