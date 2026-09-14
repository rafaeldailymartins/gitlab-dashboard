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
  /**
   * A day and its weekday, with no year — `Tuesday, 12 May`.
   *
   * `full` carries the year, and a column header that announces "2026" on every
   * one of a month's days is noise a screen-reader reader has to sit through.
   */
  dayWithWeekday: { day: 'numeric', month: 'long', weekday: 'long' },
  full: { day: 'numeric', month: 'long', weekday: 'long', year: 'numeric' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  month: { month: 'long', year: 'numeric' },
  short: { day: 'numeric', month: 'short' },
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
const spokenHourFormatters = new Map<string, Intl.NumberFormat>()
const listFormatters = new Map<string, Intl.ListFormat>()
const timeFormatters = new Map<string, Intl.DateTimeFormat>()

/**
 * A day and its weekday, for a column that names one — `Tuesday, 12 May`.
 *
 * The year is deliberately absent; see `DATE_STYLES.dayWithWeekday`.
 */
export function formatDayWithWeekday(date: IsoDate, locale: string): string {
  return formatDate(date, locale, 'dayWithWeekday')
}

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
 * Names joined the way the reader's language joins them — "Ana, Bruno and
 * Carla" in English, "Ana, Bruno e Carla" in Brazilian Portuguese.
 *
 * Through `Intl` rather than a translated separator: the conjunction, the comma
 * before it and whether there is one at all are all language-specific, and a
 * message with a hand-written `, ` would get every language but one wrong.
 */
export function formatList(items: readonly string[], locale: string): string {
  return listFormatter(locale).format(items)
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
 * A calendar date in its shortest legible form — `21 Aug`, `21 de ago.`.
 *
 * For a timestamp that has to name its day without becoming a sentence: the
 * year is left out, because the only dates written this way are recent ones.
 */
export function formatShortDate(date: IsoDate, locale: string): string {
  return formatDate(date, locale, 'short')
}

/**
 * Hours with a spelled-out unit for assistive technology — `6.7 hours`,
 * `6,7 horas`. A bar chart announces this rather than describing its shape.
 */
export function formatSpokenHours(hours: number, locale: string): string {
  return spokenHourFormatter(locale).format(hours)
}

/**
 * The clock time of an instant, in the zone the reader keeps their days in —
 * `2:32 PM` in English, `14:32` in Brazilian Portuguese.
 *
 * The zone is an argument rather than the machine's default for the same reason
 * the rest of this module pins one: a timestamp rendered in the browser's zone
 * would name an hour the reader never lived through.
 */
export function formatTimeOfDay(instant: Date, locale: string, timeZone: string): string {
  return timeFormatter(locale, timeZone).format(instant)
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

function listFormatter(locale: string): Intl.ListFormat {
  const existing = listFormatters.get(locale)

  if (existing) {
    return existing
  }

  const formatter = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' })

  listFormatters.set(locale, formatter)

  return formatter
}

/**
 * Cached like its three neighbours, and for the same reason.
 *
 * Every hour figure in the interface carries a spoken form beside it, so a
 * screen of a team's month calls this once per cell. Constructing the formatter
 * each time dominated the cost of rendering that screen.
 */
function spokenHourFormatter(locale: string): Intl.NumberFormat {
  const cached = spokenHourFormatters.get(locale)

  if (cached) {
    return cached
  }

  const created = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    style: 'unit',
    unit: 'hour',
    unitDisplay: 'long',
  })

  spokenHourFormatters.set(locale, created)

  return created
}

function timeFormatter(locale: string, timeZone: string): Intl.DateTimeFormat {
  const key = `${locale}|${timeZone}`
  const cached = timeFormatters.get(key)

  if (cached) {
    return cached
  }

  const created = new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone })

  timeFormatters.set(key, created)

  return created
}
