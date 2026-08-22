import { TZDate } from '@date-fns/tz'
import {
  addDays as addCalendarDays,
  eachDayOfInterval,
  endOfMonth as endOfCalendarMonth,
  getISODay,
  startOfMonth as startOfCalendarMonth,
  startOfWeek as startOfCalendarWeek,
} from 'date-fns'

declare const isoDateBrand: unique symbol

/**
 * A calendar date with no time and no zone, formatted `YYYY-MM-DD`.
 *
 * It is branded so an instant, a localised date string or an arbitrary string
 * cannot be passed where a calendar date is expected. Which calendar date an
 * instant falls on depends on the reader's time zone, and confusing the two is
 * the most likely source of an off-by-one-day bug in this app.
 */
export type IsoDate = string & { readonly [isoDateBrand]: true }

/** ISO 8601 weekday numbers: 1 is Monday, 7 is Sunday. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

export type Weekday = (typeof WEEKDAYS)[number]

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Arithmetic runs on `TZDate` fixed to UTC rather than on a plain `Date`, so a
 * result never depends on the zone of the machine running the code. The tests
 * would otherwise pass on a developer machine and fail on a UTC CI runner.
 */
const CALENDAR_ZONE = 'UTC'

/** Monday, matching ISO 8601 and how the dashboard presents a week. */
const WEEK_STARTS_ON = 1

/** The calendar date `days` after `date`. Negative values move backwards. */
export function addDays(date: IsoDate, days: number): IsoDate {
  return dayOf(addCalendarDays(calendarDateOf(date), days))
}

/** Every calendar date from `from` to `to`, inclusive. Empty when `to < from`. */
export function datesBetween(from: IsoDate, to: IsoDate): IsoDate[] {
  if (to < from) {
    return []
  }

  return eachDayOfInterval({ end: calendarDateOf(to), start: calendarDateOf(from) }).map((date) =>
    dayOf(date),
  )
}

/** The last day of the month containing `date`. */
export function endOfMonth(date: IsoDate): IsoDate {
  return dayOf(endOfCalendarMonth(calendarDateOf(date)))
}

/**
 * Validates a calendar date and brands it.
 *
 * @throws RangeError when the value is not a real `YYYY-MM-DD` date. A value
 *   that parses but does not exist, such as `2026-02-30`, is rejected too.
 */
export function isoDate(value: string): IsoDate {
  const match = ISO_DATE_PATTERN.exec(value)

  if (!match) {
    throw new RangeError(`Not a YYYY-MM-DD calendar date: ${value}`)
  }

  const [, year, month, day] = match
  const candidate = utcCalendarDate(Number(year), Number(month), Number(day))

  if (dayOf(candidate) !== value) {
    throw new RangeError(`Not a date that exists: ${value}`)
  }

  return brand(value)
}

/** True when the runtime recognises the IANA time zone name. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format()
    return true
  } catch {
    return false
  }
}

/** The first day of the month containing `date`. */
export function startOfMonth(date: IsoDate): IsoDate {
  return dayOf(startOfCalendarMonth(calendarDateOf(date)))
}

/** The Monday of the week containing `date`. */
export function startOfWeek(date: IsoDate): IsoDate {
  return dayOf(startOfCalendarWeek(calendarDateOf(date), { weekStartsOn: WEEK_STARTS_ON }))
}

/**
 * The calendar date an instant falls on, in the given time zone.
 *
 * This is the only place where an instant becomes a date. Everything downstream
 * is calendar arithmetic, which has no offset to be wrong about.
 *
 * @throws RangeError when the time zone is not recognised. `TZDate` itself
 *   yields an invalid date rather than throwing, and a silent `NaN` date would
 *   propagate far from its cause.
 */
export function toIsoDate(instant: Date, timeZone: string): IsoDate {
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError(`Not a recognised IANA time zone: ${timeZone}`)
  }

  return dayOf(new TZDate(instant, timeZone))
}

/**
 * Narrows a number to an ISO weekday.
 *
 * @throws RangeError when the value is not 1 through 7. Stored preferences are
 *   keyed by weekday, so this guards values read back from the device.
 */
export function toWeekday(value: number): Weekday {
  const weekday = WEEKDAYS.find((candidate) => candidate === value)

  if (weekday === undefined) {
    throw new RangeError(`Not an ISO weekday (1-7): ${String(value)}`)
  }

  return weekday
}

/** The ISO weekday of a calendar date. */
export function weekdayOf(date: IsoDate): Weekday {
  return toWeekday(getISODay(calendarDateOf(date)))
}

/**
 * Asserts the branded type. Every value reaching this point has been validated
 * by `isoDate` or produced by arithmetic on an already valid calendar date.
 */
function brand(value: string): IsoDate {
  return value as IsoDate
}

function calendarDateOf(date: IsoDate): TZDate {
  const [year, month, day] = date.split('-')

  return utcCalendarDate(Number(year), Number(month), Number(day))
}

function dayOf(date: Date): IsoDate {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return brand(`${year}-${month}-${day}`)
}

function utcCalendarDate(year: number, month: number, day: number): TZDate {
  return new TZDate(Date.UTC(year, month - 1, day), CALENDAR_ZONE)
}
