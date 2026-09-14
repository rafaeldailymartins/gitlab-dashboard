import { type IsoDate, toIsoDate } from '@/shared/lib/date'
import { secondsToHours } from '@/shared/lib/duration'

import type { ProjectRef, TimelogEntry, WorkItemRef } from './types'

/**
 * The grouping key for entries with no readable project.
 *
 * A real `fullPath` has no spaces, so this cannot collide with one and fold an
 * unreadable entry into some real project's total.
 */
export const NO_PROJECT = 'no project'

export interface DateRange {
  readonly from: IsoDate
  readonly to: IsoDate
}

/** Everything logged on one calendar day, in the reader's time zone. */
export interface DayTotal {
  readonly date: IsoDate
  readonly entryCount: number
  readonly hours: number
  /** Most time first, so the day reads as "what I mostly did". */
  readonly items: readonly WorkItemTotal[]
  readonly seconds: number
}

/** A total over any set of entries. */
export interface PeriodTotal {
  readonly entryCount: number
  readonly hours: number
  readonly seconds: number
}

/** Time spent on one work item, on one day. */
export interface WorkItemTotal {
  readonly entryCount: number
  readonly hours: number
  /** Null when the provider would not resolve it; the hours still count. */
  readonly project: null | ProjectRef
  readonly seconds: number
  /** Null for time logged without an issue or merge request. */
  readonly workItem: null | WorkItemRef
}

/**
 * Entries grouped into calendar days, newest first, each broken down by what
 * was worked on.
 *
 * This is the only place an instant becomes a day, so the time zone decision
 * has exactly one home.
 */
export function dayTotals(entries: readonly TimelogEntry[], timeZone: string): DayTotal[] {
  const byDay = new Map<IsoDate, TimelogEntry[]>()

  for (const entry of entries) {
    const date = toIsoDate(entry.spentAt, timeZone)
    const existing = byDay.get(date)

    if (existing) {
      existing.push(entry)
    } else {
      byDay.set(date, [entry])
    }
  }

  return [...byDay]
    .map(([date, dayEntries]) => dayTotalOf(date, dayEntries))
    .toSorted((left, right) => right.date.localeCompare(left.date))
}

/**
 * Only the entries that fall inside `range` once converted to calendar days.
 *
 * Which day an instant belongs to is decided in the reader's zone, so a period
 * can only be cut here, after the entries have arrived — never by the provider,
 * which knows nothing about the reader's zone.
 */
export function entriesWithin(
  entries: readonly TimelogEntry[],
  range: DateRange,
  timeZone: string,
): TimelogEntry[] {
  return entries.filter((entry) => {
    const date = toIsoDate(entry.spentAt, timeZone)

    return date >= range.from && date <= range.to
  })
}

/**
 * The total for a set of entries.
 *
 * Seconds are summed first and converted once, so a period total is exactly the
 * sum of what was logged rather than the sum of rounded day figures.
 */
export function periodTotal(entries: readonly TimelogEntry[]): PeriodTotal {
  const seconds = entries.reduce((total, entry) => total + entry.seconds, 0)

  return { entryCount: entries.length, hours: secondsToHours(seconds), seconds }
}

function byHoursDescending(left: WorkItemTotal, right: WorkItemTotal): number {
  return right.seconds - left.seconds
}

function dayTotalOf(date: IsoDate, entries: readonly TimelogEntry[]): DayTotal {
  const { entryCount, hours, seconds } = periodTotal(entries)

  return { date, entryCount, hours, items: workItemTotals(entries), seconds }
}

/**
 * Two entries on the same work item on the same day are one row.
 *
 * Time with no work item is grouped per project rather than dropped: it still
 * counts towards the day, and a reader can see which project it belongs to.
 */
function workItemTotals(entries: readonly TimelogEntry[]): WorkItemTotal[] {
  // The first entry of each group is kept alongside it, so reading the project
  // and work item back needs no guard for a group that cannot be empty.
  const byItem = new Map<string, { first: TimelogEntry; grouped: TimelogEntry[] }>()

  for (const entry of entries) {
    const key = entry.workItem?.reference ?? `unattributed:${entry.project?.fullPath ?? NO_PROJECT}`
    const existing = byItem.get(key)

    if (existing) {
      existing.grouped.push(entry)
    } else {
      byItem.set(key, { first: entry, grouped: [entry] })
    }
  }

  return [...byItem.values()]
    .map(({ first, grouped }) => ({
      ...periodTotal(grouped),
      project: first.project,
      workItem: first.workItem,
    }))
    .toSorted(byHoursDescending)
}
