import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import type { Team } from '@/entities/teams'

import { usePreferences } from '@/entities/preferences'
import {
  groupQuery,
  type GroupRef,
  readerWindow,
  teamHoursQuery,
  type TeamReport,
  teamReportFrom,
  useTeamTimelogGateway,
} from '@/entities/team-timelogs'
import { type GraphQLFailure, GraphQLRequestError } from '@/shared/api'
import { type IsoDate, toIsoDate } from '@/shared/lib/date'

import type { TeamSearch } from './search-params'

import { monthDateOf } from './search-params'
import { useWithheldPlacement } from './use-withheld-placement'

/** What the report reads for a `SyncStatus`, plus what the screen draws. */
export interface TeamHoursReport extends TeamReport {
  /** True before anything at all has arrived. */
  readonly empty: boolean
  readonly failure: GraphQLFailure | null
  readonly month: IsoDate
  /**
   * The group the figures were narrowed to, or null for the reader's whole reach.
   *
   * `unreadable` when the address names a group this reader cannot open. The
   * screen says so rather than quietly reporting everything under a caption
   * that claims a narrowing — which would overstate every figure on it.
   */
  readonly scope: 'unreadable' | GroupRef | null
  readonly sync: () => void
  readonly syncedAt: Date | null
  readonly syncing: boolean
  readonly today: IsoDate
}

/** What the query reports for `dataUpdatedAt` before a response has ever arrived. */
const NEVER = 0

/** What this hook reads of a query, named rather than inferred. */
interface Answer {
  readonly data: unknown
  readonly dataUpdatedAt: number
  readonly error: Error | null
  readonly isFetching: boolean
  readonly refetch: () => unknown
}

/**
 * A team's month, from the two questions it takes to answer it.
 *
 * The filter's path is resolved to the identifier the provider's own argument
 * takes; the rounds then read every person's window under it. A second pass
 * puts withheld hours against the day they were logged on. Every step is pure
 * but the asking.
 *
 * The cells are measured against the reader's own working hours, applied here
 * rather than asked for: a changed target redraws the month already read and
 * refetches nothing, which is why it is in no query key.
 */
export function useTeamReport(search: TeamSearch, team: null | Team): TeamHoursReport {
  const { preferences } = usePreferences()
  const month = monthDateOf(search)
  const window = useMemo(() => readerWindow(month), [month])
  const gateway = useTeamTimelogGateway()
  const group = useQuery(groupQuery(gateway, search.group))
  const groupId = group.data?.id ?? null
  const members = team?.members ?? []
  const pages = useInfiniteQuery({
    ...teamHoursQuery(gateway, { groupId, members, month, window }),
    // Asking before the filter resolves would read the whole reach once and the
    // narrowed set a moment later, and show the first of them in between.
    enabled: members.length > 0 && (search.group === '' || group.isSuccess),
  })

  useReadEveryRound(pages.hasNextPage && !pages.isFetchingNextPage, pages.fetchNextPage)

  const today = toIsoDate(new Date(), preferences.timeZone)
  const report = useMemo(
    () =>
      teamReportFrom(pages.data?.pages ?? [], {
        granularity: search.by,
        members,
        reference: preferences.dailyTarget,
        timeZone: preferences.timeZone,
        today,
        window,
      }),
    [pages.data, search.by, members, preferences.dailyTarget, preferences.timeZone, today, window],
  )
  const placed = useWithheldPlacement({ groupId, report, timeZone: preferences.timeZone })

  return {
    ...placed,
    ...statusOf(pages, group),
    month,
    scope: scopeOf(search.group, group.data, group.isSuccess),
    today,
  }
}

function failureOf(error: Error | null): GraphQLFailure | null {
  if (!error) {
    return null
  }

  return error instanceof GraphQLRequestError ? error.failure : { kind: 'unavailable' }
}

/**
 * What the figures were narrowed to, as the caption has to state it.
 *
 * Three states, not two. A group that resolved narrows the report and is named;
 * an empty filter is the reader's whole reach and says so; and a path that
 * resolved to nothing is `unreadable` — a link somebody sent to a group this
 * reader cannot open. Reporting that third case as the second would publish
 * every figure on the screen under a claim about its scope that is false.
 */
function scopeOf(
  path: string,
  group: GroupRef | null | undefined,
  resolved: boolean,
): 'unreadable' | GroupRef | null {
  if (path === '') {
    return null
  }

  if (!resolved) {
    return null
  }

  return group ?? 'unreadable'
}

/**
 * Whether anything has arrived, whether more is coming, and how to ask again.
 *
 * Both answers count: the screen is still working while either is, and asking
 * again asks both — they describe one report between them.
 */
function statusOf(pages: Answer, group: Answer) {
  return {
    empty: pages.data === undefined,
    failure: failureOf(pages.error ?? group.error),
    sync: () => {
      void pages.refetch()
      void group.refetch()
    },
    syncedAt: pages.dataUpdatedAt === NEVER ? null : new Date(pages.dataUpdatedAt),
    syncing: pages.isFetching || group.isFetching,
  }
}

/**
 * Keeps asking until every person's window has been read.
 *
 * A month is bounded, so this terminates — and in the ordinary case it never
 * runs at all: a person logging under a hundred entries in a month fits the
 * first round, so most reports are final on first paint.
 */
function useReadEveryRound(more: boolean, readNext: () => Promise<unknown>): void {
  useEffect(() => {
    if (more) {
      void readNext()
    }
  }, [more, readNext])
}
