import type { Granularity } from '@/entities/group-timelogs'

import { endOfMonth, isoDate, type IsoDate, startOfMonth } from '@/shared/lib/date'

/** The report's address: which group, which month, and which column axis. */
export interface TeamSearch {
  readonly by: Granularity
  /** Empty when the reader has not chosen a group yet. */
  readonly group: string
  /** Always the first of a month. */
  readonly month: string
}

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/

/** The first day of the month an address names, as a calendar date. */
export function monthDateOf(search: TeamSearch): IsoDate {
  return isoDate(`${search.month}-01`)
}

/** The month before or after the one an address names, as `YYYY-MM`. */
export function shiftMonth(month: string, months: number): string {
  const [year = 0, index = 1] = month.split('-').map(Number)
  const moved = index - 1 + months

  return `${String(year + Math.floor(moved / 12)).padStart(4, '0')}-${String((((moved % 12) + 12) % 12) + 1).padStart(2, '0')}`
}

/**
 * The address, made safe.
 *
 * An address is untrusted input — it may have been typed, or sent by somebody
 * else — so nothing here throws. A month that is not a month becomes the month
 * containing `today`, and an absent group becomes an empty one, which the screen
 * answers by asking the reader to choose. Failing instead would turn a mistyped
 * link into a blank screen with a stack trace behind it.
 */
export function teamSearchFrom(search: Record<string, unknown>, today: IsoDate): TeamSearch {
  return {
    by: search['by'] === 'weeks' ? 'weeks' : 'days',
    group: typeof search['group'] === 'string' ? search['group'] : '',
    month: monthFrom(search['month'], today),
  }
}

/**
 * Whether `YYYY-MM` names a month that exists.
 *
 * `2026-13` matches the pattern and is not a month, so the first of it has to be
 * built and checked rather than trusted.
 */
function isRealMonth(value: string): boolean {
  if (!MONTH_PATTERN.test(value)) {
    return false
  }

  try {
    return endOfMonth(isoDate(`${value}-01`)).startsWith(value)
  } catch {
    return false
  }
}

function monthFrom(value: unknown, today: IsoDate): string {
  if (typeof value === 'string' && isRealMonth(value)) {
    return value
  }

  return startOfMonth(today).slice(0, 7)
}
