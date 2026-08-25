import { describe, expect, it } from 'vitest'

import { isoDate } from './date'
import {
  formatFullDate,
  formatHours,
  formatShortDate,
  formatSpokenHours,
  formatTimeOfDay,
  shortWeekdayName,
  weekdayName,
} from './format'

const EN = 'en-GB'
const PT = 'pt-BR'

describe('formatHours', () => {
  it('uses the decimal separator of the locale', () => {
    expect(formatHours(6.7, EN)).toBe('6.7')
    expect(formatHours(6.7, PT)).toBe('6,7')
  })

  it('drops a zero fraction so a whole number reads as one', () => {
    expect(formatHours(8, EN)).toBe('8')
    expect(formatHours(8, PT)).toBe('8')
  })

  it('keeps two decimals at most', () => {
    expect(formatHours(0.125, EN)).toBe('0.13')
    expect(formatHours(1.005, EN)).toBe('1.01')
  })

  it('formats zero and negative durations', () => {
    expect(formatHours(0, EN)).toBe('0')
    expect(formatHours(-1.5, EN)).toBe('-1.5')
    expect(formatHours(-1.5, PT)).toBe('-1,5')
  })

  it('groups thousands for a large total', () => {
    expect(formatHours(1234.5, EN)).toBe('1,234.5')
    expect(formatHours(1234.5, PT)).toBe('1.234,5')
  })
})

describe('formatSpokenHours', () => {
  it('spells the unit out in the locale, for assistive technology', () => {
    expect(formatSpokenHours(6.7, EN)).toMatch(/hours/)
    expect(formatSpokenHours(6.7, PT)).toMatch(/horas/)
  })

  it('uses the singular where the locale does', () => {
    expect(formatSpokenHours(1, EN)).toMatch(/\bhour\b/)
  })
})

describe('formatFullDate', () => {
  it('writes the date out in the locale', () => {
    // 2026-08-21 is a Friday.
    expect(formatFullDate(isoDate('2026-08-21'), EN)).toMatch(/Friday/)
    expect(formatFullDate(isoDate('2026-08-21'), EN)).toMatch(/August/)
    expect(formatFullDate(isoDate('2026-08-21'), EN)).toMatch(/2026/)

    expect(formatFullDate(isoDate('2026-08-21'), PT)).toMatch(/sexta/i)
    expect(formatFullDate(isoDate('2026-08-21'), PT)).toMatch(/agosto/i)
  })

  it('never shifts the date, whatever zone the machine is in', () => {
    // A calendar date is held at UTC midnight. Formatting it without pinning
    // the zone would render the 21st as the 20th anywhere west of Greenwich.
    expect(formatFullDate(isoDate('2026-08-21'), EN)).toMatch(/\b21\b/)
    expect(formatFullDate(isoDate('2026-01-01'), EN)).toMatch(/\b1\b/)
    expect(formatFullDate(isoDate('2026-01-01'), EN)).toMatch(/January/)
  })
})

describe('weekdayName', () => {
  it('names each ISO weekday, Monday first', () => {
    expect(weekdayName(1, EN)).toBe('Monday')
    expect(weekdayName(5, EN)).toBe('Friday')
    expect(weekdayName(7, EN)).toBe('Sunday')
  })

  it('names weekdays in Brazilian Portuguese', () => {
    expect(weekdayName(1, PT)).toMatch(/segunda/i)
    expect(weekdayName(7, PT)).toMatch(/domingo/i)
  })
})

describe('shortWeekdayName', () => {
  it('abbreviates for a column header', () => {
    expect(shortWeekdayName(1, EN)).toBe('Mon')
    expect(shortWeekdayName(7, EN)).toBe('Sun')
  })

  it('is shorter than the full name', () => {
    expect(shortWeekdayName(3, PT).length).toBeLessThan(weekdayName(3, PT).length)
  })
})

describe('formatShortDate', () => {
  it('names the day and abbreviates the month', () => {
    expect(formatShortDate(isoDate('2026-08-21'), EN)).toMatch(/21/)
    expect(formatShortDate(isoDate('2026-08-21'), EN)).toMatch(/Aug/)
    expect(formatShortDate(isoDate('2026-08-21'), PT)).toMatch(/ago/i)
  })

  it('leaves the year out', () => {
    expect(formatShortDate(isoDate('2026-08-21'), EN)).not.toMatch(/2026/)
  })

  it('reads the date as a calendar date, whatever the machine zone is', () => {
    // Rendered in a negative-offset zone, UTC midnight on the 21st is the 20th.
    expect(formatShortDate(isoDate('2026-08-21'), EN)).toMatch(/\b21\b/)
  })
})

describe('formatTimeOfDay', () => {
  /** 15:00 UTC, which is midday in São Paulo and 17:00 in Berlin. */
  const INSTANT = new Date('2026-08-21T15:00:00Z')

  it('reads the clock of the zone it is given, not of the machine', () => {
    expect(formatTimeOfDay(INSTANT, PT, 'America/Sao_Paulo')).toBe('12:00')
    expect(formatTimeOfDay(INSTANT, PT, 'Europe/Berlin')).toBe('17:00')
  })

  it('writes the clock the way the locale does', () => {
    expect(formatTimeOfDay(INSTANT, 'en-US', 'America/Sao_Paulo')).toMatch(/12:00\s?PM/i)
    expect(formatTimeOfDay(INSTANT, EN, 'America/Sao_Paulo')).toBe('12:00')
  })

  it('leaves the seconds out', () => {
    expect(formatTimeOfDay(new Date('2026-08-21T15:00:42Z'), PT, 'UTC')).toBe('15:00')
  })
})
