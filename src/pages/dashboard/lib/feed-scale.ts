import type { DailyTarget } from '@/entities/preferences'
import type { DayTotal } from '@/entities/timelogs'

import { WEEKDAYS } from '@/shared/lib/date'

/**
 * The hours a full-width bar stands for in the day feed.
 *
 * One reference for every row, not each row against its own target: a list is
 * read by comparing its rows, and a Saturday with no target would otherwise draw
 * a full bar for two hours beside a Tuesday's full bar for eight.
 *
 * The reader's longest day is that reference. With no targets configured at all
 * it falls back to the busiest day loaded, so the bars still say something
 * relative; with nothing logged either there is nothing to draw.
 */
export function feedScale(days: readonly DayTotal[], dailyTarget: DailyTarget): number {
  const longestDay = Math.max(...WEEKDAYS.map((weekday) => dailyTarget[weekday]))

  return longestDay > 0 ? longestDay : Math.max(0, ...days.map((day) => day.hours))
}
