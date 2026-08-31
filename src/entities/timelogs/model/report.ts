import type { IsoDate } from '@/shared/lib/date'

import type { DateRange, DayTotal, PeriodTotal } from './aggregate'
import type { TimelogPage } from './ports'

import { dayTotals } from './aggregate'
import { secondsToHours } from './duration'

/**
 * A bounded period, and whether the report can answer it yet.
 *
 * `settled` is the honest part: a total over a period the loaded history does
 * not reach back to is a floor, not an answer, and a screen that presented it as
 * final would understate the reader's hours.
 */
export interface PeriodSummary extends PeriodTotal {
  readonly settled: boolean
}

/** Everything loaded so far, grouped into days, newest first. */
export interface TimelogReport {
  /** True when the provider has nothing older than what is loaded. */
  readonly complete: boolean
  readonly days: readonly DayTotal[]
  /** The oldest day loaded, or null when nothing has been loaded. */
  readonly oldestLoadedDate: IsoDate | null
  /**
   * Entries the provider withheld that nothing recovered.
   *
   * These are hours missing from every total here, and there is no way to know
   * which days they belong to, because the provider returned nothing about them.
   * Deliberately not folded into `settled`: that flag drives further requests,
   * and an unread entry never improves however many pages are read.
   */
  readonly unread: number
  /** Entries counted with no project, because the provider would not resolve it. */
  readonly withoutProject: number
}

// Nothing loaded is not the same as nothing to load: an empty report claiming to
// be complete would let a screen present zero hours as a final answer.
const NOTHING_LOADED: TimelogReport = {
  complete: false,
  days: [],
  oldestLoadedDate: null,
  unread: 0,
  withoutProject: 0,
}

/**
 * The total for one bounded period, cut from the loaded days.
 *
 * Day totals are summed in seconds and converted once, so a period total is
 * exactly the sum of what was logged rather than the sum of rounded days.
 */
export function periodSummary(report: TimelogReport, range: DateRange): PeriodSummary {
  const days = report.days.filter((day) => day.date >= range.from && day.date <= range.to)
  const seconds = days.reduce((total, day) => total + day.seconds, 0)

  return {
    entryCount: days.reduce((total, day) => total + day.entryCount, 0),
    hours: secondsToHours(seconds),
    seconds,
    settled: isSettled(report, range),
  }
}

/**
 * Groups the loaded pages into days in the reader's time zone.
 *
 * Pages are read newest first, so the days come out newest first too and the
 * periods a reader cares about most are the ones settled soonest.
 */
export function reportFrom(pages: readonly TimelogPage[], timeZone: string): TimelogReport {
  const last = pages.at(-1)

  if (!last) {
    return NOTHING_LOADED
  }

  const days = dayTotals(
    pages.flatMap((page) => page.entries),
    timeZone,
  )
  const recovered = countOver(pages, (page) => page.recovered)

  return {
    complete: last.nextCursor === null,
    days,
    oldestLoadedDate: days.at(-1)?.date ?? null,
    unread: countOver(pages, (page) => page.withheld) - recovered,
    withoutProject: recovered,
  }
}

/** Sums one of the per-page counts, reading an absent one as zero. */
function countOver(
  pages: readonly TimelogPage[],
  count: (page: TimelogPage) => number | undefined,
): number {
  return pages.reduce((total, page) => total + (count(page) ?? 0), 0)
}

/**
 * A period is settled once the loaded history reaches past its start.
 *
 * Strictly past, not up to: a page boundary can fall in the middle of a day, so
 * the oldest loaded day may itself be incomplete.
 */
function isSettled(report: TimelogReport, range: DateRange): boolean {
  return (
    report.complete || (report.oldestLoadedDate !== null && report.oldestLoadedDate < range.from)
  )
}
