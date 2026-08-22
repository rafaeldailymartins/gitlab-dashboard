import type { DayTotal } from '@/entities/timelogs'

import { type DailyTarget, targetForDate } from '@/entities/preferences'
import { datesBetween, endOfMonth, type IsoDate, startOfMonth, weekdayOf } from '@/shared/lib/date'

const DAYS_IN_WEEK = 7

/** One square of the heatmap. A padding cell has no date. */
export interface HeatCell {
  readonly band: HeatBand
  readonly date: IsoDate | null
  readonly hours: number
  /** True when the day carries a target, so an empty one is worth noticing. */
  readonly isWorkingDay: boolean
}

/** How much of a full day a cell holds, in four bands plus nothing. */
type HeatBand = 0 | 1 | 2 | 3 | 4

/**
 * A month as calendar weeks, Monday first, padded to whole weeks.
 *
 * Padding cells carry no date: a square for a day in another month would invite
 * the reader to compare it with the ones that belong here.
 *
 * A working day with nothing logged is the thing this view exists to show, so it
 * is distinguishable from a day with time and from a day outside the month —
 * band 0 with `isWorkingDay` true, rather than an absent cell.
 */
export function monthGrid(
  days: readonly DayTotal[],
  dailyTarget: DailyTarget,
  month: IsoDate,
): HeatCell[][] {
  const hoursByDate = new Map(days.map((day) => [day.date, day.hours]))
  const first = startOfMonth(month)
  const last = endOfMonth(month)
  const leading = weekdayOf(first) - 1
  const cells: HeatCell[] = Array.from({ length: leading }, () => PADDING)

  for (const date of datesBetween(first, last)) {
    const target = targetForDate(dailyTarget, date)
    const hours = hoursByDate.get(date) ?? 0

    cells.push({ band: bandOf(hours, target), date, hours, isWorkingDay: target > 0 })
  }

  while (cells.length % DAYS_IN_WEEK !== 0) {
    cells.push(PADDING)
  }

  return Array.from({ length: cells.length / DAYS_IN_WEEK }, (_unused, week) =>
    cells.slice(week * DAYS_IN_WEEK, (week + 1) * DAYS_IN_WEEK),
  )
}

const PADDING: HeatCell = { band: 0, date: null, hours: 0, isWorkingDay: false }

/**
 * Which band an amount of time falls in, measured against the day's own target
 * so a four-hour Friday on a four-hour target reads as full.
 *
 * Days with no target are measured against eight hours, which is the only
 * defensible stand-in: a weekend has no expectation to be a share of.
 */
function bandOf(hours: number, target: number): HeatBand {
  if (hours <= 0) {
    return 0
  }

  const share = hours / (target > 0 ? target : FALLBACK_TARGET)

  if (share >= 1) {
    return 4
  }

  if (share >= TWO_THIRDS) {
    return 3
  }

  return share >= ONE_THIRD ? 2 : 1
}

const FALLBACK_TARGET = 8
const ONE_THIRD = 1 / 3
const TWO_THIRDS = 2 / 3
