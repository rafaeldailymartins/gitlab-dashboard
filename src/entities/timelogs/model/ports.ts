import type { TimelogEntry } from './types'

/**
 * Everything the app needs from a time-tracking provider.
 *
 * It exists so the rules and the screens can be exercised without HTTP, not to
 * abstract over a second provider.
 */
export interface TimelogGateway {
  /** `signal` lets a caller abandon a request whose answer it no longer needs. */
  myTimelogs(query: TimelogQuery, signal?: AbortSignal): Promise<TimelogPage>
}

/**
 * One page of the reader's own timelogs, newest first.
 *
 * There is no period in the request. The provider filters by UTC calendar date
 * while a day here is a day in the reader's zone, so asking it for a period
 * would return a window that does not line up with the one on screen. Reading
 * newest-first instead makes every recent period — today, this week, this
 * month — arrive in the first page, and periods are cut from the loaded entries
 * where the time zone is known.
 */
export interface TimelogPage {
  readonly entries: readonly TimelogEntry[]
  /** Pass to the next request. Null when there is nothing older. */
  readonly nextCursor: null | string
}

/** What to ask the provider for. */
interface TimelogQuery {
  /** A cursor from a previous page, or null for the newest entries. */
  readonly after: null | string
}
