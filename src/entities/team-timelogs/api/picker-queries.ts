import { queryOptions } from '@tanstack/react-query'

import type { SuggestionQuery, TeamTimelogGateway } from '../model/ports'

import { GC_TIME, NOT_PERSISTED, STALE_TIME, TEAM_TIMELOGS_KEY } from './query-shape'

/**
 * The group an address names, resolved to what the provider's filter takes.
 *
 * Disabled on an empty path, which is the unnarrowed default rather than a
 * group nobody could find. Long-lived: a group's identifier does not change,
 * and this is on the path of every scoped report.
 */
export function groupQuery(gateway: TeamTimelogGateway, fullPath: string) {
  return queryOptions({
    enabled: fullPath !== '',
    gcTime: GC_TIME,
    meta: NOT_PERSISTED,
    queryFn: ({ signal }) => gateway.group(fullPath, signal),
    queryKey: [TEAM_TIMELOGS_KEY, 'group', fullPath] as const,
    refetchOnWindowFocus: false,
    staleTime: STALE_TIME,
  })
}

/** The groups the reader may open, for the filter and for seeding a team. */
export function groupSearchQuery(gateway: TeamTimelogGateway, search: null | string) {
  return queryOptions({
    gcTime: GC_TIME,
    meta: NOT_PERSISTED,
    queryFn: ({ signal }) => gateway.groups(search, signal),
    queryKey: [TEAM_TIMELOGS_KEY, 'groups', search] as const,
    staleTime: STALE_TIME,
  })
}

/**
 * People the provider can find by name or handle.
 *
 * Disabled on an empty search: `users(search: "")` is every user the provider
 * will show this reader, which is a page of strangers offered as teammates.
 */
export function peopleSearchQuery(gateway: TeamTimelogGateway, search: string) {
  return queryOptions({
    enabled: search.trim() !== '',
    gcTime: GC_TIME,
    meta: NOT_PERSISTED,
    queryFn: ({ signal }) => gateway.people(search, signal),
    queryKey: [TEAM_TIMELOGS_KEY, 'people', search] as const,
    staleTime: STALE_TIME,
  })
}

/** Whoever logged time in a group over the window. Read to its cap inside the gateway. */
export function teamSuggestionsQuery(gateway: TeamTimelogGateway, query: SuggestionQuery) {
  return queryOptions({
    gcTime: GC_TIME,
    meta: NOT_PERSISTED,
    queryFn: ({ signal }) => gateway.suggestions(query, signal),
    queryKey: [TEAM_TIMELOGS_KEY, 'suggestions', query.fullPath, query.from, query.to] as const,
    refetchOnWindowFocus: false,
    staleTime: STALE_TIME,
  })
}
