import { isoDate, type IsoDate } from './date'

const MONTH_PATTERN = /^\d{4}-\d{2}$/
const MONTH_LENGTH = 'YYYY-MM'.length

/**
 * The calendar day an address carries, or undefined when it carries none that
 * exists.
 *
 * An address is untrusted input — typed, or sent by somebody else — so nothing
 * here throws: `2026-02-30`, `yesterday` and a number all read as no day at all,
 * which a screen takes to mean today.
 *
 * Here rather than beside the screens that read it, because a route's
 * `validateSearch` is not code-split: importing it from a page's public API
 * would put that whole page in the bundle every reader downloads.
 */
export function dayParam(value: unknown): IsoDate | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  try {
    return isoDate(value)
  } catch {
    return undefined
  }
}

/**
 * The month an address carries as `YYYY-MM`, or undefined when it carries none
 * that exists. `2026-13` matches the shape and is not a month.
 */
export function monthParam(value: unknown): string | undefined {
  if (typeof value !== 'string' || !MONTH_PATTERN.test(value)) {
    return undefined
  }

  return dayParam(`${value}-01`) === undefined ? undefined : value
}

/** The `YYYY-MM` an address uses for the month containing `date`. */
export function monthParamOf(date: IsoDate): string {
  return date.slice(0, MONTH_LENGTH)
}

/** The first day of the month `YYYY-MM` names. Only for a value `monthParam` accepted. */
export function monthStart(param: string): IsoDate {
  return isoDate(`${param}-01`)
}
