import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import { usePreferences } from '@/entities/preferences'
import {
  type DayTotal,
  myTimelogsQuery,
  periodSummaries,
  type PeriodSummary,
  reportFrom,
  useTimelogGateway,
} from '@/entities/timelogs'
import { type GraphQLFailure, GraphQLRequestError } from '@/shared/api'
import { type IsoDate, toIsoDate } from '@/shared/lib/date'

/** What the query reports for `dataUpdatedAt` before a response has ever arrived. */
const NEVER = 0

export interface HoursReport {
  /** True while an older page is on its way, over days already on screen. */
  readonly appending: boolean
  /** True when the provider has nothing older than what is loaded. */
  readonly complete: boolean
  /** The day the report was asked about. */
  readonly day: PeriodSummary
  readonly days: readonly DayTotal[]
  /** Set when the last request failed. Figures already on screen stay. */
  readonly failure: GraphQLFailure | null
  /** True once figures are on screen, whether fresh or restored from cache. */
  readonly hasFigures: boolean
  /** Asks for the page before the oldest day loaded. */
  readonly loadOlder: () => void
  /** The calendar month containing the day the report was asked about. */
  readonly month: PeriodSummary
  /** Asks GitLab for the loaded history again, and is also how a failure is retried. */
  readonly sync: () => void
  /**
   * When GitLab last answered, or null before it ever has. It survives a reload
   * because the query cache is persisted with it — a failed request leaves it
   * where it was, which is what makes it honest.
   */
  readonly syncedAt: Date | null
  /** True while any request over the history is in flight, first or later. */
  readonly syncing: boolean
  /**
   * Entries GitLab withheld that nothing recovered.
   *
   * These are hours missing from every figure here. Deliberately separate from
   * `settled`: that one drives further requests, and an unread entry never
   * improves however many pages are read.
   */
  readonly unread: number
  /** The Monday-to-Sunday week containing the day the report was asked about. */
  readonly week: PeriodSummary
  /** Entries counted with no project, because GitLab would not resolve it. */
  readonly withoutProject: number
}

/**
 * The reader's hours, grouped in their own time zone, summarised around `day`.
 *
 * `day` is today unless a screen asks about another. The query carries no
 * period either way: history arrives newest first, so today's periods are
 * answered by the first page, and an earlier day's are answered by reading on
 * until history passes the start of its week and of its month. Older days extend
 * the same cache entry instead of starting a new one, so moving between days
 * never asks GitLab for anything already read.
 */
export function useHoursReport(day?: IsoDate): HoursReport {
  const { preferences } = usePreferences()
  const query = useInfiniteQuery(myTimelogsQuery(useTimelogGateway()))
  const { timeZone } = preferences
  const anchor = day ?? toIsoDate(new Date(), timeZone)

  const report = useMemo(
    () => reportFrom(query.data?.pages ?? [], timeZone),
    [query.data, timeZone],
  )
  const periods = useMemo(() => periodSummaries(report, anchor), [report, anchor])

  const unsettled = !periods.settled && query.hasNextPage

  useSettlePeriods(unsettled ? report.days.length : null, query.fetchNextPage)

  return {
    appending: query.isFetchingNextPage,
    complete: report.complete,
    day: periods.day,
    days: report.days,
    failure: failureOf(query.error),
    hasFigures: query.data !== undefined,
    loadOlder: () => {
      void query.fetchNextPage()
    },
    month: periods.month,
    sync: () => {
      void query.refetch()
    },
    syncedAt: query.dataUpdatedAt === NEVER ? null : new Date(query.dataUpdatedAt),
    syncing: query.isFetching,
    unread: report.unread,
    week: periods.week,
    withoutProject: report.withoutProject,
  }
}

function failureOf(error: Error | null): GraphQLFailure | null {
  if (!error) {
    return null
  }

  return error instanceof GraphQLRequestError ? error.failure : { kind: 'unavailable' }
}

/**
 * Keeps loading while a period of the day is still a floor rather than an answer.
 *
 * For today a page holds a hundred entries, which is a season of ordinary
 * logging, so this only fires for someone who logs many times a day — for whom
 * a month total that silently understated itself would be the worst outcome.
 * For a day the reader chose further back it is what reads history back to it.
 */
function useSettlePeriods(loadedDays: null | number, loadOlder: () => Promise<unknown>): void {
  // The day count is in the dependencies, not just the unsettled flag: a month
  // spanning three pages has to ask again after each one, and a boolean that
  // stayed true would leave the effect thinking nothing had changed.
  useEffect(() => {
    if (loadedDays !== null) {
      void loadOlder()
    }
  }, [loadedDays, loadOlder])
}
