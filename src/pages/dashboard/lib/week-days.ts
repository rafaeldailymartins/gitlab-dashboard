import type { DayTotal } from '@/entities/timelogs'

import { type DailyTarget, targetForDate } from '@/entities/preferences'
import {
  addDays,
  datesBetween,
  type IsoDate,
  startOfWeek,
  type Weekday,
  weekdayOf,
} from '@/shared/lib/date'

const LAST_DAY_OF_WEEK = 6

/** One column of the strip: what was logged against what was expected. */
export interface WeekDay {
  readonly date: IsoDate
  readonly hours: number
  readonly isToday: boolean
  /** Height of the bar as a fraction of the tallest thing in the week. */
  readonly ratio: number
  readonly targetHours: number
  /** Where the target sits on that same scale, so a bar reaching it means met. */
  readonly targetRatio: number
  readonly weekday: Weekday
}

/**
 * The seven days of the week `today` falls in.
 *
 * Days with nothing logged are present with zero hours rather than missing: an
 * unlogged Wednesday is the most useful thing this strip can show, and a gap
 * would read as a rendering fault instead.
 *
 * Bars are scaled against the tallest of the week's hours *and* targets, so a
 * day above target stays inside the strip and a quiet week is not stretched to
 * look full.
 */
export function weekDays(
  days: readonly DayTotal[],
  dailyTarget: DailyTarget,
  today: IsoDate,
): WeekDay[] {
  const start = startOfWeek(today)
  const hoursByDate = new Map(days.map((day) => [day.date, day.hours]))

  const columns = datesBetween(start, addDays(start, LAST_DAY_OF_WEEK)).map((date) => ({
    date,
    hours: hoursByDate.get(date) ?? 0,
    isToday: date === today,
    targetHours: targetForDate(dailyTarget, date),
    weekday: weekdayOf(date),
  }))

  const tallest = Math.max(...columns.map((column) => Math.max(column.hours, column.targetHours)))

  return columns.map((column) => ({
    ...column,
    ratio: tallest > 0 ? column.hours / tallest : 0,
    targetRatio: tallest > 0 ? column.targetHours / tallest : 0,
  }))
}
