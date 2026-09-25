import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import type { IsoDate } from '@/shared/lib/date'

import type {
  ColumnProbeQuery,
  MemberCursor,
  TeamHoursPage,
  TeamTimelogGateway,
} from '../model/ports'
import type { Member } from '../model/types'
import type { ReaderWindow } from '../model/window'

import { BRIEFLY, GC_TIME, NOT_PERSISTED, STALE_TIME, TEAM_TIMELOGS_KEY } from './query-shape'

/** Which team, which month, how far it is narrowed, and the window it resolves to. */
export interface HoursRequest {
  /** The group the figures are narrowed to, or null for the reader's whole reach. */
  readonly groupId: null | string
  readonly members: readonly Member[]
  readonly month: IsoDate
  readonly window: ReaderWindow
}

/**
 * The first round asks about everybody; later ones continue whoever is unfinished.
 *
 * Null is the first round. It is a page parameter rather than two queries
 * because the rounds are one reading of one window: the report folds them
 * together and the aggregates ride on the first of them.
 */
const FIRST_ROUND: null | readonly MemberCursor[] = null

/**
 * One person's period, column by column — where their withheld hours fall.
 *
 * Keyed by the person, by the filter and by the spans themselves rather than by
 * the month: the spans already carry the month, the granularity and the reader's
 * zone, so a reader who switches to week columns or changes zone asks a
 * different question and gets a different answer rather than a stale one.
 *
 * `gcTime` is short. This answer is only ever read once, immediately, to place
 * marks on a report already on screen; keeping a month of them per person would
 * hold a team's hours in memory long after the reader moved on.
 */
export function teamColumnsQuery(gateway: TeamTimelogGateway, query: ColumnProbeQuery) {
  return queryOptions({
    gcTime: BRIEFLY,
    meta: NOT_PERSISTED,
    queryFn: ({ signal }) => gateway.columns(query, signal),
    queryKey: [
      TEAM_TIMELOGS_KEY,
      'columns',
      query.memberId,
      query.groupId,
      query.from,
      query.to,
      query.columns.length,
    ] as const,
    refetchOnWindowFocus: false,
    staleTime: STALE_TIME,
  })
}

/**
 * A month of a team's entries, oldest first.
 *
 * Keyed by the month, by the filter and by the team because, unlike the personal
 * history, this request *is* bounded by a period: two months are two different
 * answers and neither is a prefix of the other. The filter joins the key because
 * it changes every figure the answer carries.
 *
 * `refetchOnWindowFocus` is off. It is on by default, and for an infinite query
 * a focus refetch re-runs **every** round — so leaving it on would re-read the
 * whole month each time the reader came back from another window.
 */
export function teamHoursQuery(gateway: TeamTimelogGateway, request: HoursRequest) {
  const { groupId, members, month, window } = request

  return infiniteQueryOptions({
    gcTime: GC_TIME,
    getNextPageParam: nextRound,
    initialPageParam: FIRST_ROUND,
    meta: NOT_PERSISTED,
    queryFn: async ({ pageParam, signal }) =>
      pageParam === null
        ? gateway.timelogs({ from: window.from, groupId, members, to: window.to }, signal)
        : gateway.following(
            { cursors: pageParam, from: window.from, groupId, to: window.to },
            signal,
          ),
    queryKey: [TEAM_TIMELOGS_KEY, 'hours', month, groupId, teamKey(members)] as const,
    refetchOnWindowFocus: false,
    staleTime: STALE_TIME,
  })
}

/**
 * Where every still-unfinished person left off, or null when nobody is.
 *
 * Read from `nextCursor` alone rather than from whether a round carried entries:
 * the provider computes `hasNextPage` before removing what the reader may not
 * read, so a round can carry no nodes and still have more after it.
 */
function nextRound(page: TeamHoursPage): null | readonly MemberCursor[] {
  const cursors = page.members.flatMap((member) =>
    member.nextCursor === null ? [] : [{ cursor: member.nextCursor, memberId: member.person.id }],
  )

  return cursors.length === 0 ? null : cursors
}

/**
 * The team as a cache key.
 *
 * Sorted, so reordering the same people is the same question. The collation is
 * stated rather than left to the runtime's default, which would make the key
 * depend on the machine.
 */
function teamKey(members: readonly Member[]): readonly string[] {
  return members
    .map((member) => member.id)
    .toSorted((left, right) => left.localeCompare(right, 'en'))
}
