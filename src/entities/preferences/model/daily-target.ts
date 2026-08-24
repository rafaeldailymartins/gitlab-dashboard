import { type IsoDate, type Weekday, weekdayOf, WEEKDAYS } from '@/shared/lib/date'

/** Target hours for each ISO weekday. Zero is a legitimate target. */
export type DailyTarget = Readonly<Record<Weekday, number>>

/** Eight hours Monday to Friday, nothing at the weekend. */
export const DEFAULT_DAILY_TARGET: DailyTarget = { 1: 8, 2: 8, 3: 8, 4: 8, 5: 8, 6: 0, 7: 0 }

/** A day cannot hold more hours than it has. */
export const MAX_TARGET_HOURS = 24

/**
 * How a day or a period compares with its target.
 *
 * `ratio` is null when there is no target to measure against, which is what
 * keeps the interface from having to divide by zero or invent a percentage for
 * a Saturday. Time logged against a zero target is above target, not a
 * shortfall.
 */
export interface TargetProgress {
  /** Hours logged minus hours targeted. Positive means above target. */
  readonly balanceHours: number
  readonly isMet: boolean
  readonly loggedHours: number
  /** Fraction of the target met, clamped to at most 1, or null if no target. */
  readonly ratio: null | number
  readonly targetHours: number
}

/**
 * Reads a daily target out of unvalidated data, keeping every value that is
 * usable and defaulting the rest. A single bad weekday does not discard the
 * others.
 */
export function dailyTargetFrom(source: unknown): DailyTarget {
  const target = { ...DEFAULT_DAILY_TARGET }

  // An array is an object whose indices 1 and 2 would read as Tuesday and
  // Wednesday, so it is rejected rather than half understood.
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    return target
  }

  const entries: Record<string, unknown> = { ...source }

  for (const weekday of WEEKDAYS) {
    const value = entries[String(weekday)]

    if (typeof value === 'number' && isValidTargetHours(value)) {
      target[weekday] = value
    }
  }

  return target
}

/** True when `hours` is a target a day could actually hold. */
export function isValidTargetHours(hours: number): boolean {
  return Number.isFinite(hours) && hours >= 0 && hours <= MAX_TARGET_HOURS
}

/** The target for the weekday `date` falls on. */
export function targetForDate(target: DailyTarget, date: IsoDate): number {
  return target[weekdayOf(date)]
}

/** The combined target for a set of dates, such as a week or a month. */
export function targetForDates(target: DailyTarget, dates: readonly IsoDate[]): number {
  return dates.reduce((total, date) => total + targetForDate(target, date), 0)
}

/** How `loggedHours` compares with `targetHours`. */
export function targetProgress(loggedHours: number, targetHours: number): TargetProgress {
  return {
    balanceHours: loggedHours - targetHours,
    isMet: loggedHours >= targetHours,
    loggedHours,
    ratio: targetHours > 0 ? Math.min(loggedHours / targetHours, 1) : null,
    targetHours,
  }
}

/**
 * A copy of `target` with one weekday changed.
 *
 * @throws RangeError when `hours` is not a target a day could hold, so an
 *   invalid value can never reach storage or a calculation.
 */
export function withWeekdayTarget(
  target: DailyTarget,
  weekday: Weekday,
  hours: number,
): DailyTarget {
  if (!isValidTargetHours(hours)) {
    throw new RangeError(`A daily target must be between 0 and ${String(MAX_TARGET_HOURS)} hours`)
  }

  return { ...target, [weekday]: hours }
}
