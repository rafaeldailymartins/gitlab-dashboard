import { queryOptions } from '@tanstack/react-query'

import { NOT_PERSISTED, REPORTED_BY_ITS_ENDPOINT } from '@/shared/api'

import type { TeamsGateway } from '../model/ports'

export const TEAMS_KEY = ['teams'] as const

const MINUTE = 60 * 1000

/**
 * The reader's own teams, which nobody else can change.
 *
 * Long-lived on purpose: a team changes when this reader changes it, and every
 * edit writes the answer straight back into the cache. Refetching on focus
 * would spend a request per tab switch to learn what this tab already knows.
 *
 * Never persisted: a team is a list of colleagues, and a shared or borrowed
 * machine keeps no part of somebody else's. The cost is a picker that is empty
 * until the store answers, and it is small: the report asks the provider before
 * it draws a figure anyway.
 */
export function teamsQuery(gateway: TeamsGateway) {
  return queryOptions({
    gcTime: 30 * MINUTE,
    meta: { ...NOT_PERSISTED, ...REPORTED_BY_ITS_ENDPOINT },
    queryFn: ({ signal }) => gateway.read(signal),
    queryKey: TEAMS_KEY,
    refetchOnWindowFocus: false,
    staleTime: 5 * MINUTE,
  })
}
