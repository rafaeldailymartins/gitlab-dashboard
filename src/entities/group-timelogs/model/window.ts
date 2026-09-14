import {
  addDays,
  endOfMonth,
  type IsoDate,
  spanInstantsIn,
  startOfMonth,
  toIsoDate,
} from '@/shared/lib/date'

import type { GridColumn } from './columns'
import type { DateRange, GroupTimelogEntry } from './types'

/** The window to ask the provider for, and the month to cut from its answer. */
export interface ReaderWindow {
  /** Sent as `startTime`. An instant with an explicit `Z` offset, inclusive. */
  readonly from: string
  /** The month as the reader sees it, in their own time zone. */
  readonly period: DateRange
  /** Sent as `endTime`. An instant with an explicit `Z` offset, inclusive. */
  readonly to: string
}

/**
 * Only the entries whose calendar day, in `timeZone`, falls inside `range`.
 *
 * This is where the widened window becomes the reader's month, and the only
 * place an instant in this slice becomes a day.
 */
export function entriesWithin(
  entries: readonly GroupTimelogEntry[],
  range: DateRange,
  timeZone: string,
): GroupTimelogEntry[] {
  return entries.filter((entry) => {
    const date = toIsoDate(entry.spentAt, timeZone)

    return date >= range.from && date <= range.to
  })
}

/**
 * The reader's month, widened by one whole UTC day at each end.
 *
 * The widening is what makes the answer a superset of the month under every
 * reading the provider could give the range — exact instants, or a range
 * rounded out to whole calendar days in any offset — because rounding can only
 * move a start earlier and an end later. The month is then cut from that
 * superset by `entriesWithin`, in the reader's own zone. So the report never
 * depends on the provider treating the range one way rather than another, which
 * is a stronger guarantee than having checked which way it does.
 *
 * One day of slack is always enough: no IANA offset exceeds fourteen hours, so
 * the earliest instant that can fall on the reader's first local day is ten
 * hours into the day before it, and the latest on their last is twelve hours
 * into the day after.
 *
 * Both ends carry an explicit `Z`, so no server-side default zone can enter.
 * The pair is built here, together, because a range that mixed an exact end with
 * a rounded start would be wrong in one direction only — the hardest kind of
 * wrong to notice.
 */
export function readerWindow(month: IsoDate): ReaderWindow {
  const period = { from: startOfMonth(month), to: endOfMonth(month) }

  return {
    from: `${addDays(period.from, -1)}T00:00:00.000Z`,
    period,
    to: `${addDays(period.to, 1)}T23:59:59.999Z`,
  }
}

/**
 * Each column as the exact instants it opens and closes at.
 *
 * The one place this app asks a provider about a span **narrower** than the
 * widened window, and it is deliberate: a span that reached into its neighbour
 * would attribute the neighbour's withheld hours to it. Placing an hour on a
 * day nobody logged it on is worse than not placing it, so the answer is
 * checked against the period before any of it is drawn — see `model/withheld.ts`.
 *
 * A column carries `from` and `to` as calendar days, so one span covers a day
 * column and a week column alike.
 */
export function spanColumns(
  columns: readonly GridColumn[],
  timeZone: string,
): { from: string; key: string; to: string }[] {
  return columns.map((column) => ({
    ...spanInstantsIn(column.from, column.to, timeZone),
    key: column.key,
  }))
}
