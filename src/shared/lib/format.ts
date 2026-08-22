import { addDays, isoDate, type IsoDate, type Weekday } from './date'

/**
 * An `IsoDate` is a calendar date, and this module represents it as UTC
 * midnight. Formatting it must pin the zone to UTC: in a negative-offset zone
 * the machine default would render 2026-08-21 as the 20th.
 */
const CALENDAR_ZONE = 'UTC'

/** Monday of an arbitrary week, used to name weekdays without needing a date. */
const REFERENCE_MONDAY = isoDate('2026-08-17')

const DATE_STYLES = {
  full: { day: 'numeric', month: 'long', weekday: 'long', year: 'numeric' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  month: { month: 'long', year: 'numeric' },
  weekdayLong: { weekday: 'long' },
  weekdayShort: { weekday: 'short' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>

type DateStyle = keyof typeof DATE_STYLES

/**
 * `Intl` formatter construction dominates the cost of formatting, and the day
 * feed formats one date per row, so formatters are built once per locale and
 * style.
 */
const dateFormatters = new Map<string, Intl.DateTimeFormat>()
const hourFormatters = new Map<string, Intl.NumberFormat>()

/** A calendar date written out in full, as a heading — `Friday, 21 August 2026`. */
export function formatFullDate(date: IsoDate, locale: string): string {
  return formatDate(date, locale, 'full')
}

/**
 * The hours figure alone, in the reader's locale — `6.7` in English, `6,7` in
 * Brazilian Portuguese.
 *
 * The unit is deliberately absent: it is a translated string the interface
 * renders separately, so the number can carry its own typography. Use
 * `formatSpokenHours` wherever the value is read aloud instead of seen.
 */
export function formatHours(hours: number, locale: string): string {
  return hourFormatter(locale).format(hours)
}

/**
 * The same date without its weekday — `21 August 2026`.
 *
 * For the places that print the weekday themselves: a row saying "Friday, 21
 * August 2026" above "Friday" says it twice.
 */
export function formatLongDate(date: IsoDate, locale: string): string {
  return formatDate(date, locale, 'long')
}

/** A month and its year, as a heading — `August 2026`, `agosto de 2026`. */
export function formatMonth(date: IsoDate, locale: string): string {
  return formatDate(date, locale, 'month')
}

/**
 * Hours with a spelled-out unit for assistive technology — `6.7 hours`,
 * `6,7 horas`. A bar chart announces this rather than describing its shape.
 */
export function formatSpokenHours(hours: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    style: 'unit',
    unit: 'hour',
    unitDisplay: 'long',
  }).format(hours)
}

/** The abbreviated name of an ISO weekday, for a column header — `Mon`, `seg.`. */
export function shortWeekdayName(weekday: Weekday, locale: string): string {
  return formatDate(addDays(REFERENCE_MONDAY, weekday - 1), locale, 'weekdayShort')
}

/** The name of an ISO weekday, with no date attached — `Monday`, `segunda-feira`. */
export function weekdayName(weekday: Weekday, locale: string): string {
  return formatDate(addDays(REFERENCE_MONDAY, weekday - 1), locale, 'weekdayLong')
}

function dateFormatter(locale: string, style: DateStyle): Intl.DateTimeFormat {
  const key = `${locale}|${style}`
  const cached = dateFormatters.get(key)

  if (cached) {
    return cached
  }

  const created = new Intl.DateTimeFormat(locale, {
    ...DATE_STYLES[style],
    timeZone: CALENDAR_ZONE,
  })

  dateFormatters.set(key, created)

  return created
}

function formatDate(date: IsoDate, locale: string, style: DateStyle): string {
  return dateFormatter(locale, style).format(new Date(`${date}T00:00:00Z`))
}

function hourFormatter(locale: string): Intl.NumberFormat {
  const cached = hourFormatters.get(locale)

  if (cached) {
    return cached
  }

  const created = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })

  hourFormatters.set(locale, created)

  return created
}
