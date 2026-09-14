import {
  addDays,
  datesBetween,
  earlierOf,
  endOfWeek,
  type IsoDate,
  isoWeekOf,
  isoWeekYearOf,
  startOfWeek,
  weekdayOf,
} from '@/shared/lib/date'

import type { DateRange, ReferenceSchedule } from './types'

/** Whether a column is one day or one whole ISO week. */
export type Granularity = 'days' | 'weeks'

/** One column of the matrix. A day column has `from === to`. */
export interface GridColumn {
  readonly from: IsoDate
  /** `2026-05-12` for a day, `2026-W20` for a week. Stable across renders. */
  readonly key: string
  /** What the stated reference expects across this column. Zero expects nothing. */
  readonly referenceHours: number
  readonly to: IsoDate
}

/** A run of day columns belonging to one ISO week. */
export interface WeekBand {
  /** How many columns it spans, for `colspan` and `<colgroup>`. */
  readonly columnCount: number
  readonly from: IsoDate
  readonly isoWeek: number
  /**
   * The ISO week-numbering year, which is not always the calendar year: the
   * first days of January can belong to the last week of the year before.
   */
  readonly isoWeekYear: number
  readonly to: IsoDate
}

/**
 * The columns of the matrix, in calendar order.
 *
 * A week column is clipped to the period, so a month that starts on a Wednesday
 * opens with a three-day week whose reference is three days' worth rather than
 * five. Reporting a partial week against a whole week's reference would mark
 * every month boundary as a shortfall nobody owes.
 */
export function columnsOf(
  period: DateRange,
  granularity: Granularity,
  reference: ReferenceSchedule,
): GridColumn[] {
  if (granularity === 'days') {
    return datesBetween(period.from, period.to).map((date) => ({
      from: date,
      key: date,
      referenceHours: referenceOver(date, date, reference),
      to: date,
    }))
  }

  return weekSpansOf(period).map(({ from, to }) => ({
    from,
    key: weekKeyOf(from),
    referenceHours: referenceOver(from, to, reference),
    to,
  }))
}

/**
 * The ISO weeks the day columns fall into, one band per week.
 *
 * Empty for week columns: each one is already a week, and a band over a single
 * column would say the same thing twice.
 */
export function weekBandsOf(columns: readonly GridColumn[], granularity: Granularity): WeekBand[] {
  if (granularity !== 'days') {
    return []
  }

  const bands: WeekBand[] = []

  for (const column of columns) {
    const last = bands.at(-1)

    if (last?.isoWeek === isoWeekOf(column.from)) {
      bands[bands.length - 1] = { ...last, columnCount: last.columnCount + 1, to: column.to }
    } else {
      bands.push(bandOf(column))
    }
  }

  return bands
}

function bandOf(column: GridColumn): WeekBand {
  return {
    columnCount: 1,
    from: column.from,
    isoWeek: isoWeekOf(column.from),
    isoWeekYear: isoWeekYearOf(column.from),
    to: column.to,
  }
}

/** What the reference expects across an inclusive run of days. */
function referenceOver(from: IsoDate, to: IsoDate, reference: ReferenceSchedule): number {
  return datesBetween(from, to).reduce((hours, date) => hours + reference[weekdayOf(date)], 0)
}

/** `2026-W20`, from the week-numbering year so a January week names its own. */
function weekKeyOf(date: IsoDate): string {
  const monday = startOfWeek(date)

  return `${String(isoWeekYearOf(monday))}-W${String(isoWeekOf(monday)).padStart(2, '0')}`
}

/** The weeks the period touches, each clipped to the period's own bounds. */
function weekSpansOf(period: DateRange): DateRange[] {
  const spans: DateRange[] = []
  let cursor = period.from

  while (cursor <= period.to) {
    const to = earlierOf(endOfWeek(cursor), period.to)

    spans.push({ from: cursor, to })
    cursor = addDays(to, 1)
  }

  return spans
}
