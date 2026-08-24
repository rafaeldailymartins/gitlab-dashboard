import { infiniteQueryOptions } from '@tanstack/react-query'

import type { TimelogGateway, TimelogPage } from '../model/ports'

/**
 * One key for the whole history.
 *
 * The request carries no period, so there is nothing to key on: every screen
 * reads the same newest-first history and cuts the period it needs from it.
 * That is also what lets the month summary and the day feed share one cache
 * entry instead of refetching the same entries under two keys.
 */
const MY_TIMELOGS_KEY = ['timelogs', 'mine'] as const

/** The first page. Null asks for the newest entries. */
const NEWEST_FIRST: null | string = null

export function myTimelogsQuery(gateway: TimelogGateway) {
  return infiniteQueryOptions({
    getNextPageParam: (page: TimelogPage) => page.nextCursor,
    initialPageParam: NEWEST_FIRST,
    queryFn: ({ pageParam, signal }) => gateway.myTimelogs({ after: pageParam }, signal),
    queryKey: MY_TIMELOGS_KEY,
  })
}
