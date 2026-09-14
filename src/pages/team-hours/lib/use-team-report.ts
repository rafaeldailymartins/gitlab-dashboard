import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import {
  groupHoursQuery,
  groupProbeQuery,
  type GroupReport,
  groupReportFrom,
  groupRosterQuery,
  readerWindow,
  type ReaderWindow,
  REFERENCE_SCHEDULE,
  useGroupTimelogGateway,
} from '@/entities/group-timelogs'
import { usePreferences } from '@/entities/preferences'
import { type GraphQLFailure, GraphQLRequestError } from '@/shared/api'
import { type IsoDate, toIsoDate } from '@/shared/lib/date'

import type { TeamSearch } from './search-params'

import { shownRows } from './rows'
import { monthDateOf } from './search-params'
import { useWithheldPlacement } from './use-withheld-placement'

/** What the report reads for a `SyncStatus`, plus what the screen draws. */
export interface TeamReport extends GroupReport {
  /** True before anything at all has arrived. */
  readonly empty: boolean
  readonly failure: GraphQLFailure | null
  readonly month: IsoDate
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

/** The three answers as one thing the screen can ask about their progress. */
interface Answers {
  readonly pages: Answer
  readonly probe: Answer
  readonly roster: Answer
}

/**
 * One group's month, composed from the three questions it takes to answer it.
 *
 * Three answers from the provider, one report built out of them, a second pass
 * that puts withheld hours against the day they were logged on, and a last one
 * that decides who is drawn. Every step is pure but the asking.
 */
export function useTeamReport(search: TeamSearch): TeamReport {
  const { preferences } = usePreferences()
  const month = monthDateOf(search)
  const window = useMemo(() => readerWindow(month), [month])
  const { pages, probe, roster } = useGroupAnswers(search, window)

  useReadEveryPage(pages.hasNextPage && !pages.isFetchingNextPage, pages.fetchNextPage)

  const today = toIsoDate(new Date(), preferences.timeZone)
  const report = useMemo(
    () =>
      groupReportFrom(pages.data?.pages ?? [], {
        granularity: search.by,
        probe: probe.data ?? null,
        reference: REFERENCE_SCHEDULE,
        roster: roster.data?.members ?? [],
        timeZone: preferences.timeZone,
        today,
        window,
      }),
    [pages.data, probe.data, roster.data, search, preferences.timeZone, today, window],
  )

  // The placement runs on the report before anything is dropped from it: a row
  // whose whole month was withheld has no visible entries, and it is exactly the
  // row the marks have something to say about.
  const placed = useWithheldPlacement({
    fullPath: search.group,
    report,
    timeZone: preferences.timeZone,
  })
  const drawn = useMemo(() => drawnFrom(placed), [placed])

  return { ...placed, ...statusOf({ pages, probe, roster }), ...drawn, month, today }
}

/**
 * The report as the screen draws it: everybody counted, not everybody drawn.
 *
 * The grid is replaced rather than filtered in place, so every total on it was
 * computed over the whole roster before anybody was left out of the table.
 * Nobody is named for having been left out — see `lib/rows.ts`.
 */
function drawnFrom(report: GroupReport): Pick<TeamReport, 'grid'> {
  return { grid: { ...report.grid, rows: shownRows(report) } }
}

function failureOf(error: Error | null): GraphQLFailure | null {
  if (!error) {
    return null
  }

  return error instanceof GraphQLRequestError ? error.failure : { kind: 'unavailable' }
}

/**
 * Whether anything has arrived, whether more is coming, and how to ask again.
 *
 * All three answers count: the screen is not empty once any of them has landed,
 * it is still working while any of them is, and asking again asks all three —
 * they describe one report between them.
 */
function statusOf({ pages, probe, roster }: Answers) {
  return {
    empty: pages.data === undefined && roster.data === undefined,
    failure: failureOf(pages.error ?? roster.error ?? probe.error),
    sync: () => {
      void pages.refetch()
      void probe.refetch()
      void roster.refetch()
    },
    syncedAt: pages.dataUpdatedAt === NEVER ? null : new Date(pages.dataUpdatedAt),
    syncing: pages.isFetching || roster.isFetching || probe.isFetching,
  }
}

/**
 * The three questions it takes to answer one group's month.
 *
 * The roster comes first because who to probe about comes from it. The pages
 * and the probe then run together: the pages carry the hours, and the probe
 * carries what the provider says exists — which is the only thing that can tell
 * the screen how much of the answer it is not being shown.
 */
function useGroupAnswers(search: TeamSearch, window: ReaderWindow) {
  const gateway = useGroupTimelogGateway()
  const month = monthDateOf(search)
  const enabled = search.group !== ''
  const roster = useQuery({ ...groupRosterQuery(gateway, search.group), enabled })
  const usernames = useMemo(
    () => (roster.data?.members ?? []).map((member) => member.person.username),
    [roster.data],
  )
  const pages = useInfiniteQuery({
    ...groupHoursQuery(gateway, { fullPath: search.group, month, window }),
    enabled,
  })
  const probe = useQuery({
    ...groupProbeQuery(gateway, { ...window, fullPath: search.group, usernames }, month),
    enabled: enabled && roster.isSuccess,
  })

  return { pages, probe, roster }
}

/**
 * Keeps asking until the window has been read.
 *
 * A month is bounded, so this terminates — and it has to run to the end before
 * any per-person figure may be shown, because until then every one of them is a
 * number that will change.
 */
function useReadEveryPage(more: boolean, readNext: () => Promise<unknown>): void {
  useEffect(() => {
    if (more) {
      void readNext()
    }
  }, [more, readNext])
}
