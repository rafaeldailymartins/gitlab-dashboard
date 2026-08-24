import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import { usePreferences } from '@/entities/preferences'
import {
  type DayTotal,
  myTimelogsQuery,
  periodSummary,
  type PeriodSummary,
  reportFrom,
  useTimelogGateway,
} from '@/entities/timelogs'
import { type GraphQLFailure, GraphQLRequestError } from '@/shared/api'
import { addDays, endOfMonth, startOfMonth, startOfWeek, toIsoDate } from '@/shared/lib/date'

const LAST_DAY_OF_WEEK = 6

export interface HoursReport {
  /** True while an older page is on its way, over days already on screen. */
  readonly appending: boolean
  /** True when the provider has nothing older than what is loaded. */
  readonly complete: boolean
  readonly days: readonly DayTotal[]
  /** Set when the last request failed. Figures already on screen stay. */
  readonly failure: GraphQLFailure | null
  /** True once figures are on screen, whether fresh or restored from cache. */
  readonly hasFigures: boolean
  /** Set while a request is in flight over figures already on screen. */
  readonly isRefreshing: boolean
  /** Asks for the page before the oldest day loaded. */
  readonly loadOlder: () => void
  readonly month: PeriodSummary
  readonly retry: () => void
  readonly today: PeriodSummary
  readonly week: PeriodSummary
}

/**
 * The reader's hours, grouped in their own time zone.
 *
 * The query carries no period: history arrives newest first, so today, this
 * week and this month are answered by the first page, and older days extend the
 * same cache entry instead of starting a new one.
 */
export function useHoursReport(): HoursReport {
  const { preferences } = usePreferences()
  const query = useInfiniteQuery(myTimelogsQuery(useTimelogGateway()))
  const { timeZone } = preferences

  const report = useMemo(
    () => reportFrom(query.data?.pages ?? [], timeZone),
    [query.data, timeZone],
  )
  const periods = useMemo(() => summarise(report, timeZone), [report, timeZone])

  const unsettled = !periods.month.settled && query.hasNextPage

  useSettleMonth(unsettled ? report.days.length : null, query.fetchNextPage)

  return {
    ...periods,
    appending: query.isFetchingNextPage,
    complete: report.complete,
    days: report.days,
    failure: failureOf(query.error),
    hasFigures: query.data !== undefined,
    isRefreshing: query.isFetching,
    loadOlder: () => {
      void query.fetchNextPage()
    },
    retry: () => {
      void query.refetch()
    },
  }
}

function failureOf(error: Error | null): GraphQLFailure | null {
  if (!error) {
    return null
  }

  return error instanceof GraphQLRequestError ? error.failure : { kind: 'unavailable' }
}

function summarise(report: ReturnType<typeof reportFrom>, timeZone: string) {
  const today = toIsoDate(new Date(), timeZone)
  const weekStart = startOfWeek(today)

  return {
    month: periodSummary(report, { from: startOfMonth(today), to: endOfMonth(today) }),
    today: periodSummary(report, { from: today, to: today }),
    week: periodSummary(report, { from: weekStart, to: addDays(weekStart, LAST_DAY_OF_WEEK) }),
  }
}

/**
 * Keeps loading while the month total is still a floor rather than an answer.
 *
 * A page holds a hundred entries, which is a season of ordinary logging, so this
 * only fires for someone who logs many times a day — for whom a month total
 * that silently understated itself would be the worst outcome.
 */
function useSettleMonth(loadedDays: null | number, loadOlder: () => Promise<unknown>): void {
  // The day count is in the dependencies, not just the unsettled flag: a month
  // spanning three pages has to ask again after each one, and a boolean that
  // stayed true would leave the effect thinking nothing had changed.
  useEffect(() => {
    if (loadedDays !== null) {
      void loadOlder()
    }
  }, [loadedDays, loadOlder])
}
