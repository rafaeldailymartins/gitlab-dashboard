import { TZDate } from '@date-fns/tz'
import {
  addDays as addCalendarDays,
  eachDayOfInterval,
  endOfMonth as endOfCalendarMonth,
  endOfWeek as endOfCalendarWeek,
  getISODay,
  getISOWeek,
  getISOWeekYear,
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

/** What `isValidTimeZone` has already asked the runtime. See its comment. */
const validatedZones = new Map<string, boolean>()

/**
 * The widest offsets any IANA zone uses: +14:00 and −12:00.
 *
 * A local day therefore begins no earlier than fourteen hours before that
 * date at UTC midnight, and no later than twelve hours after it.
 */
const LARGEST_OFFSET_MS = 14 * 60 * 60 * 1000
const SMALLEST_OFFSET_MS = -12 * 60 * 60 * 1000

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

/**
 * The earlier of two calendar dates.
 *
 * A statement rather than `left < right ? left : right` on purpose:
 * `unicorn/prefer-math-min-max` rewrites that shape to `Math.min(left, right)`
 * with no type information to stop it, and `Math.min` over two `YYYY-MM-DD`
 * strings coerces them to numbers and returns `NaN`. It has done so twice in
 * this codebase already, which is why the comparison lives here and not in the
 * places that need it.
 */
export function earlierOf(left: IsoDate, right: IsoDate): IsoDate {
  if (left < right) {
    return left
  }

  return right
}

/** The last day of the month containing `date`. */
export function endOfMonth(date: IsoDate): IsoDate {
  return dayOf(endOfCalendarMonth(calendarDateOf(date)))
}

/** The Sunday of the week containing `date`. */
export function endOfWeek(date: IsoDate): IsoDate {
  return dayOf(endOfCalendarWeek(calendarDateOf(date), { weekStartsOn: WEEK_STARTS_ON }))
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

/** The ISO 8601 week number of a calendar date, 1 through 53. */
export function isoWeekOf(date: IsoDate): number {
  return getISOWeek(calendarDateOf(date))
}

/**
 * The ISO 8601 week-numbering year of a calendar date.
 *
 * Not the calendar year: 1 January 2027 is a Friday, so it belongs to week 53 of
 * the week-numbering year 2026. A band labelled with the calendar year would
 * name a week that year does not contain.
 */
export function isoWeekYearOf(date: IsoDate): number {
  return getISOWeekYear(calendarDateOf(date))
}

/**
 * True when the runtime recognises the IANA time zone name.
 *
 * Answers are remembered because `toIsoDate` asks on every call and a screen
 * that groups a team's month into days asks it once per entry — thousands of
 * times per render, each one otherwise constructing an `Intl.DateTimeFormat`.
 * The set of zones a runtime recognises does not change while a page is open.
 */
export function isValidTimeZone(timeZone: string): boolean {
  const remembered = validatedZones.get(timeZone)

  if (remembered !== undefined) {
    return remembered
  }

  const valid = recognises(timeZone)

  validatedZones.set(timeZone, valid)

  return valid
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
/**
 * The instants an inclusive run of local days begins and ends at.
 *
 * For asking a provider about exactly the days the reader sees. Both bounds
 * are meant to be sent as an inclusive pair, so the end is one microsecond
 * before the next day begins rather than the next day's own first instant:
 * GitLab compares `spent_at >= ?` and `spent_at <= ?`, so two adjacent spans
 * sharing an instant would count an entry logged on it twice, and two spans a
 * whole millisecond apart would open a gap once a day for an entry to vanish
 * into. `spent_at` is stored to the microsecond, which is why the step is one.
 *
 * The start is found by bisection rather than by constructing local midnight,
 * because in some zones local midnight does not exist. São Paulo advanced its
 * clocks at midnight every spring until 2019: the day began at 01:00, and
 * asking for 00:00 there asks for a time that never happened. Bisecting on
 * `toIsoDate` finds the first instant that *is* in the day, whatever the
 * zone did, and it needs no table of transitions to do it.
 */
export function spanInstantsIn(
  from: IsoDate,
  to: IsoDate,
  timeZone: string,
): { from: string; to: string } {
  const opens = firstInstantOf(from, timeZone)
  const closes = firstInstantOf(addDays(to, 1), timeZone)

  return { from: new Date(opens).toISOString(), to: microsecondBefore(closes) }
}

/** The first day of the month containing `date`. */
export function startOfMonth(date: IsoDate): IsoDate {
  return dayOf(startOfCalendarMonth(calendarDateOf(date)))
}

/** The Monday of the week containing `date`. */
export function startOfWeek(date: IsoDate): IsoDate {
  return dayOf(startOfCalendarWeek(calendarDateOf(date), { weekStartsOn: WEEK_STARTS_ON }))
}

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

/**
 * The first instant that falls on `date` in `timeZone`.
 *
 * Bisection over the only window a local day can begin in. The predicate is
 * monotonic — every instant after the day starts is on that day or later — so
 * thirty-odd halvings land on the boundary exactly, including one the zone
 * skipped over.
 */
function firstInstantOf(date: IsoDate, timeZone: string): number {
  const midnightUtc = Date.parse(`${date}T00:00:00.000Z`)
  let earlier = midnightUtc - LARGEST_OFFSET_MS - 1
  let later = midnightUtc - SMALLEST_OFFSET_MS

  while (later - earlier > 1) {
    const middle = earlier + Math.floor((later - earlier) / 2)

    if (toIsoDate(new Date(middle), timeZone) < date) {
      earlier = middle
    } else {
      later = middle
    }
  }

  return later
}

/**
 * One microsecond before an instant, as an ISO 8601 string.
 *
 * A zone offset is always a whole number of minutes, so the instant a day
 * begins is a whole second and the millisecond before it ends in `.999`.
 * Appending three more digits therefore reads `.999999`, which is the last
 * microsecond of the previous day.
 */
function microsecondBefore(instant: number): string {
  const millisecondBefore = new Date(instant - 1).toISOString()

  return `${millisecondBefore.slice(0, -1)}999Z`
}

function recognises(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format()
    return true
  } catch {
    return false
  }
}

function utcCalendarDate(year: number, month: number, day: number): TZDate {
  return new TZDate(Date.UTC(year, month - 1, day), CALENDAR_ZONE)
}
