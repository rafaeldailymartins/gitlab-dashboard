import type { DayTotal, WorkItemTotal } from './aggregate'
import type { ProjectRef, WorkItemRef } from './types'

import { NO_PROJECT } from './aggregate'
import { secondsToHours } from './duration'

/** Everything logged against one work item over a set of days. */
export interface ItemTotal {
  readonly days: number
  readonly hours: number
  /** Null when the provider would not resolve it; the hours still count. */
  readonly project: null | ProjectRef
  readonly seconds: number
  /** Null for time logged without an issue or merge request. */
  readonly workItem: null | WorkItemRef
}

export interface OtherProjects {
  /** How many projects were folded together here. */
  readonly count: number
  readonly hours: number
  readonly seconds: number
  readonly share: number
}

/** The whole period split by project: the named ones, and the rest as one. */
export interface ProjectSplit {
  /** Null when every project fits in `top`. */
  readonly others: null | OtherProjects
  readonly top: readonly ProjectTotal[]
}

/** Everything logged against one project over a set of days. */
export interface ProjectTotal {
  readonly hours: number
  /** Null when the provider would not resolve it; the hours still count. */
  readonly project: null | ProjectRef
  readonly seconds: number
  /** Fraction of the period's seconds, or 0 when the period is empty. */
  readonly share: number
}

/**
 * Hours per work item across the days given, busiest first.
 *
 * `days` counts how many separate days an item was worked on, which is what
 * separates one long sitting from something that kept coming back.
 */
export function itemTotals(days: readonly DayTotal[]): ItemTotal[] {
  const byItem = new Map<string, { dayCount: number; first: WorkItemTotal; seconds: number }>()

  for (const day of days) {
    for (const item of day.items) {
      const key = item.workItem?.reference ?? `unattributed:${item.project?.fullPath ?? NO_PROJECT}`
      const existing = byItem.get(key)

      if (existing) {
        existing.dayCount += 1
        existing.seconds += item.seconds
      } else {
        byItem.set(key, { dayCount: 1, first: item, seconds: item.seconds })
      }
    }
  }

  return [...byItem.values()]
    .map(({ dayCount, first, seconds }) => ({
      days: dayCount,
      hours: secondsToHours(seconds),
      project: first.project,
      seconds,
      workItem: first.workItem,
    }))
    .toSorted((left, right) => right.seconds - left.seconds)
}

/**
 * The busiest `limit` projects, with everything past them folded into one.
 *
 * Folding rather than cycling a palette: past the colours a set has, reusing one
 * would tell a reader that two different projects are the same thing. The folded
 * row carries the remaining seconds, so the split still accounts for the whole
 * period.
 */
export function projectSplit(days: readonly DayTotal[], limit: number): ProjectSplit {
  const totals = projectTotals(days)
  const tail = totals.slice(limit)
  const seconds = tail.reduce((sum, entry) => sum + entry.seconds, 0)

  return {
    others:
      tail.length === 0
        ? null
        : {
            count: tail.length,
            hours: secondsToHours(seconds),
            seconds,
            share: tail.reduce((sum, entry) => sum + entry.share, 0),
          },
    top: totals.slice(0, limit),
  }
}

/**
 * Hours per project across the days given, busiest first.
 *
 * Projects are keyed by their full path rather than their name: two projects in
 * different groups can share a name, and merging them would invent a total that
 * belongs to neither. Entries with no readable project are one group: there is
 * nothing to tell them apart by, and a row each would say they were different
 * projects, which nothing here knows.
 */
export function projectTotals(days: readonly DayTotal[]): ProjectTotal[] {
  const byProject = new Map<string, { first: WorkItemTotal; seconds: number }>()

  for (const item of days.flatMap((day) => day.items)) {
    const existing = byProject.get(projectKeyOf(item))

    if (existing) {
      existing.seconds += item.seconds
    } else {
      byProject.set(projectKeyOf(item), { first: item, seconds: item.seconds })
    }
  }

  const total = [...byProject.values()].reduce((sum, entry) => sum + entry.seconds, 0)

  return [...byProject.values()]
    .map(({ first, seconds }) => ({
      hours: secondsToHours(seconds),
      project: first.project,
      seconds,
      share: total === 0 ? 0 : seconds / total,
    }))
    .toSorted((left, right) => right.seconds - left.seconds)
}

function projectKeyOf(item: WorkItemTotal): string {
  return item.project?.fullPath ?? NO_PROJECT
}
