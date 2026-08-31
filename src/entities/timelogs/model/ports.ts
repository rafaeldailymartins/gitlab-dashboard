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
  /**
   * How many of the withheld entries were read back without their project.
   *
   * Optional, like `withheld`, and absent for the same reason.
   */
  readonly recovered?: number
  /**
   * How many entries the provider withheld from this page entirely.
   *
   * Optional because a page restored from the device cache carries neither
   * count. That reads as zero and is provably right: the code that wrote those
   * pages threw a partial answer away rather than persisting it, so every
   * persisted page is a whole one.
   */
  readonly withheld?: number
}

/** What to ask the provider for. */
interface TimelogQuery {
  /** A cursor from a previous page, or null for the newest entries. */
  readonly after: null | string
}
