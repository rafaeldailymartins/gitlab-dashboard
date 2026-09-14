import { addDays, earlierOf, type IsoDate, toIsoDate } from '@/shared/lib/date'
import { secondsToHours } from '@/shared/lib/duration'

import type { Granularity } from './columns'
import type { Shortfall, TeamGrid } from './grid'
import type { DeclaredTotals, GroupHoursPage, GroupProbe } from './ports'
import type {
  GroupRef,
  GroupTimelogEntry,
  PeriodTotal,
  ReferenceSchedule,
  RosterMember,
} from './types'
import type { ReaderWindow } from './window'

import { shortfallOf, teamGrid } from './grid'

/** Everything the screen needs, derived from what has been read so far. */
export interface GroupReport {
  /**
   * True once every page of the window has been read.
   *
   * There is no separate settled flag as the personal report has: this request
   * is bounded by a period, so having read all of it *is* being settled.
   */
  readonly complete: boolean
  /** What the provider says the window holds, before it removed anything. */
  readonly declared: DeclaredTotals
  readonly grid: TeamGrid
  readonly group: GroupRef | null
  /** The last day the read is complete through, or null before anything is. */
  readonly loadedThrough: IsoDate | null
  /** Signed, over the whole group. Null before the window has been read. */
  readonly shortfall: null | Shortfall
  /** What was read and can be shown. */
  readonly visible: PeriodTotal
}

export interface ReportOptions {
  readonly granularity: Granularity
  readonly probe: GroupProbe | null
  readonly reference: ReferenceSchedule
  readonly roster: readonly RosterMember[]
  readonly timeZone: string
  readonly today: IsoDate
  readonly window: ReaderWindow
}

const NOTHING_DECLARED: DeclaredTotals = { entryCount: 0, seconds: 0 }

/**
 * The report as the pages read so far describe it.
 *
 * The group total is deliberately not the sum of the rows: `declared` covers the
 * whole widened window, including anybody the roster does not list and anybody
 * the reader may not see, so comparing it against the visible total is what
 * makes the shortfall a measurement rather than an estimate. The comparison is
 * only made once the window has been read in full — before that the difference
 * is just the part not read yet.
 */
export function groupReportFrom(
  pages: readonly GroupHoursPage[],
  options: ReportOptions,
): GroupReport {
  const last = pages.at(-1)
  const complete = last?.nextCursor === null
  const read = pages.flatMap((page) => page.entries)
  const loadedThrough = frontierOf(read, complete, options)
  const visible = visibleTotalOf(read)

  return {
    ...whatTheProbeSays(options.probe, complete, visible),
    complete,
    grid: gridOf(read, loadedThrough, options),
    group: options.probe?.group ?? last?.group ?? null,
    loadedThrough,
    visible,
  }
}

/**
 * The last day every entry of which has certainly been read.
 *
 * Entries arrive oldest first, so the newest one read marks the frontier — and
 * the frontier is the day *before* it, because the next page can still carry
 * more entries for that same day. Null until something has been read: nothing
 * can be said about any day yet.
 */
function frontierOf(
  read: readonly GroupTimelogEntry[],
  complete: boolean,
  options: ReportOptions,
): IsoDate | null {
  const { period } = options.window

  if (complete) {
    return period.to
  }

  const newest = read.at(-1)

  if (!newest) {
    return null
  }

  const frontier = addDays(toIsoDate(newest.spentAt, options.timeZone), -1)

  return earlierOf(frontier, period.to)
}

/**
 * The matrix.
 *
 * Handed everything read, uncut. `teamGrid` cuts it to the period itself, so
 * that the figures it draws and the shortfall it measures come out of one set
 * rather than out of two that can disagree about which days they cover.
 */
function gridOf(
  read: readonly GroupTimelogEntry[],
  loadedThrough: IsoDate | null,
  options: ReportOptions,
): TeamGrid {
  return teamGrid({
    entries: read,
    granularity: options.granularity,
    loadedThrough,
    period: options.window.period,
    perPerson: options.probe?.perPerson ?? new Map(),
    reference: options.reference,
    roster: options.roster,
    timeZone: options.timeZone,
    today: options.today,
  })
}

/**
 * What was read across the whole widened window, not only the reader's month.
 *
 * It is compared against `declared`, which the provider computed over that same
 * widened window. Cutting one to the month and not the other would report the
 * padding days as missing hours.
 */
function visibleTotalOf(read: readonly GroupTimelogEntry[]): PeriodTotal {
  const seconds = read.reduce((sum, entry) => sum + entry.seconds, 0)

  return { entryCount: read.length, hours: secondsToHours(seconds), seconds }
}

/**
 * What the provider says exists, and how far short of it the answer fell.
 *
 * The shortfall is only stated once the window has been read: before that the
 * difference is the part not read yet, not the part withheld.
 */
function whatTheProbeSays(
  probe: GroupProbe | null,
  complete: boolean,
  visible: PeriodTotal,
): Pick<GroupReport, 'declared' | 'shortfall'> {
  if (!probe) {
    return { declared: NOTHING_DECLARED, shortfall: null }
  }

  return {
    declared: probe.declared,
    shortfall: complete ? shortfallOf(probe.declared, visible) : null,
  }
}
