import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import type { IsoDate } from '@/shared/lib/date'

import type {
  ColumnProbeQuery,
  GroupHoursPage,
  GroupTimelogGateway,
  ProbeQuery,
} from '../model/ports'
import type { ReaderWindow } from '../model/window'

/**
 * Marks every answer in this slice as one that must not reach the device.
 *
 * A group's hours belong to people other than the reader, and a shared or
 * borrowed machine would otherwise show them to whoever opens the app next. It
 * travels on the query rather than as a key the persister has to recognise, so
 * the rule lives with the thing it is about and nothing else has to import it.
 */
const NOT_PERSISTED = { persist: false }

const GROUP_TIMELOGS_KEY = 'group-timelogs'

const MINUTE = 60 * 1000

/** A month that has ended does not change; one in progress changes slowly. */
const STALE_TIME = 5 * MINUTE

const GC_TIME = 30 * MINUTE

/** Which group, which month, and the window that month resolves to. */
export interface HoursRequest {
  readonly fullPath: string
  readonly month: IsoDate
  readonly window: ReaderWindow
}

/** The first page. Null asks for the oldest entry in the window. */
const FIRST_PAGE: null | string = null

/**
 * The window's aggregates and each person's own total.
 *
 * Enabled only once the roster is known, because who to ask about comes from it.
 * The usernames are part of the key: asking about more people is a different
 * question with a different answer.
 */
/**
 * One person's period, column by column — where their withheld hours fall.
 *
 * Keyed by the person and by the spans themselves rather than by the month: the
 * spans already carry the month, the granularity and the reader's zone, so a
 * reader who switches to week columns or changes zone asks a different question
 * and gets a different answer rather than a stale one.
 *
 * `gcTime` is short. This answer is only ever read once, immediately, to place
 * marks on a report already on screen; keeping a month of them per person would
 * hold a group's hours in memory long after the reader moved on.
 */
export function groupColumnsQuery(gateway: GroupTimelogGateway, query: ColumnProbeQuery) {
  return queryOptions({
    gcTime: MINUTE,
    meta: NOT_PERSISTED,
    queryFn: ({ signal }) => gateway.columns(query, signal),
    queryKey: [
      GROUP_TIMELOGS_KEY,
      'columns',
      query.fullPath,
      query.username,
      query.from,
      query.to,
      query.columns.length,
    ] as const,
    refetchOnWindowFocus: false,
    staleTime: STALE_TIME,
  })
}

/**
 * A month of one group's entries, oldest first.
 *
 * Keyed by the group and the month because, unlike the personal history, this
 * request *is* bounded by a period: two months are two different answers and
 * neither is a prefix of the other.
 *
 * `refetchOnWindowFocus` is off. It is on by default, and for an infinite query
 * a focus refetch re-runs **every** page — so leaving it on would re-read a
 * thirty-page month each time the reader came back from another window.
 */
export function groupHoursQuery(gateway: GroupTimelogGateway, request: HoursRequest) {
  const { fullPath, month, window } = request

  return infiniteQueryOptions({
    gcTime: GC_TIME,
    getNextPageParam: (page: GroupHoursPage) => page.nextCursor,
    initialPageParam: FIRST_PAGE,
    meta: NOT_PERSISTED,
    queryFn: ({ pageParam, signal }) =>
      gateway.timelogs({ after: pageParam, from: window.from, fullPath, to: window.to }, signal),
    queryKey: [GROUP_TIMELOGS_KEY, 'hours', fullPath, month] as const,
    refetchOnWindowFocus: false,
    staleTime: STALE_TIME,
  })
}

export function groupProbeQuery(gateway: GroupTimelogGateway, query: ProbeQuery, month: IsoDate) {
  // Sorted so the key does not change when the roster arrives in a different
  // order. The collation is stated rather than left to the runtime’s default,
  // which would make the key depend on the machine.
  const usernames = [...(query.usernames ?? [])].toSorted((left, right) =>
    left.localeCompare(right, 'en'),
  )

  return queryOptions({
    gcTime: GC_TIME,
    meta: NOT_PERSISTED,
    queryFn: ({ signal }) => gateway.probe(query, signal),
    queryKey: [GROUP_TIMELOGS_KEY, 'probe', query.fullPath, month, usernames] as const,
    refetchOnWindowFocus: false,
    staleTime: STALE_TIME,
  })
}

/** The group's membership. Read to exhaustion inside the gateway. */
export function groupRosterQuery(gateway: GroupTimelogGateway, fullPath: string) {
  return queryOptions({
    gcTime: GC_TIME,
    meta: NOT_PERSISTED,
    queryFn: ({ signal }) => gateway.roster({ fullPath }, signal),
    queryKey: [GROUP_TIMELOGS_KEY, 'roster', fullPath] as const,
    refetchOnWindowFocus: false,
    staleTime: STALE_TIME,
  })
}

/** The groups the reader may open, for the picker. */
export function groupSearchQuery(gateway: GroupTimelogGateway, search: null | string) {
  return queryOptions({
    gcTime: GC_TIME,
    meta: NOT_PERSISTED,
    queryFn: ({ signal }) => gateway.groups(search, signal),
    queryKey: [GROUP_TIMELOGS_KEY, 'groups', search] as const,
    staleTime: STALE_TIME,
  })
}
