import { describe, expect, it } from 'vitest'

import {
  addDays,
  datesBetween,
  endOfMonth,
  isoDate,
  isValidTimeZone,
  startOfMonth,
  startOfWeek,
  toIsoDate,
  toWeekday,
  weekdayOf,
} from './date'

const SAO_PAULO = 'America/Sao_Paulo'
const NEW_YORK = 'America/New_York'
const TOKYO = 'Asia/Tokyo'

describe('isoDate', () => {
  it('accepts a calendar date', () => {
    expect(isoDate('2026-08-21')).toBe('2026-08-21')
  })

  it.each(['20260821', '2026-8-21', '2026/08/21', '', '2026-08-21T00:00:00Z', 'today'])(
    'rejects the malformed value %o',
    (value) => {
      expect(() => isoDate(value)).toThrow(RangeError)
    },
  )

  it.each(['2026-02-30', '2026-13-01', '2026-00-10', '2026-04-31'])(
    'rejects %s, which parses but does not exist',
    (value) => {
      expect(() => isoDate(value)).toThrow(/does not exist|not a date that exists/i)
    },
  )

  it('accepts 29 February in a leap year', () => {
    expect(isoDate('2024-02-29')).toBe('2024-02-29')
  })

  it('rejects 29 February outside a leap year', () => {
    expect(() => isoDate('2026-02-29')).toThrow(RangeError)
  })
})

describe('isValidTimeZone', () => {
  it.each([SAO_PAULO, NEW_YORK, TOKYO, 'UTC'])('recognises %s', (timeZone) => {
    expect(isValidTimeZone(timeZone)).toBe(true)
  })

  it.each(['Mars/Olympus', 'Not/AZone', '', 'America/Sao Paulo'])('rejects %o', (timeZone) => {
    expect(isValidTimeZone(timeZone)).toBe(false)
  })
})

describe('toIsoDate', () => {
  it('uses the calendar date in the given zone, not in UTC', () => {
    // 15:00Z is midday in Sao Paulo (UTC-3): the same date either way.
    expect(toIsoDate(new Date('2026-08-20T15:00:00Z'), SAO_PAULO)).toBe('2026-08-20')
  })

  it('reports the previous day for an instant just after UTC midnight', () => {
    // 02:00Z on the 21st is 23:00 on the 20th in Sao Paulo. Counting this on
    // the 21st is the off-by-one-day bug this function exists to prevent.
    expect(toIsoDate(new Date('2026-08-21T02:00:00Z'), SAO_PAULO)).toBe('2026-08-20')
    expect(toIsoDate(new Date('2026-08-21T02:00:00Z'), 'UTC')).toBe('2026-08-21')
  })

  it('reports the next day for a zone ahead of UTC', () => {
    // 15:00Z is already midnight of the 21st in Tokyo (UTC+9).
    expect(toIsoDate(new Date('2026-08-20T15:00:00Z'), TOKYO)).toBe('2026-08-21')
  })

  it('follows the offset in force across a daylight saving transition', () => {
    // New York moves from UTC-5 to UTC-4 at 07:00Z on 2026-03-08.
    expect(toIsoDate(new Date('2026-03-08T04:00:00Z'), NEW_YORK)).toBe('2026-03-07')
    expect(toIsoDate(new Date('2026-03-08T08:00:00Z'), NEW_YORK)).toBe('2026-03-08')
  })

  it('pads single-digit months and days', () => {
    expect(toIsoDate(new Date('2026-01-05T12:00:00Z'), 'UTC')).toBe('2026-01-05')
  })

  it('rejects an unrecognised zone', () => {
    expect(() => toIsoDate(new Date('2026-08-20T15:00:00Z'), 'Mars/Olympus')).toThrow(RangeError)
  })
})

describe('toWeekday', () => {
  it.each([1, 2, 3, 4, 5, 6, 7])('accepts %i', (value) => {
    expect(toWeekday(value)).toBe(value)
  })

  it.each([0, 8, -1, 1.5, Number.NaN])('rejects %o', (value) => {
    expect(() => toWeekday(value)).toThrow(RangeError)
  })
})

describe('weekdayOf', () => {
  it('numbers Monday as 1 and Sunday as 7, per ISO 8601', () => {
    expect(weekdayOf(isoDate('2026-08-17'))).toBe(1)
    expect(weekdayOf(isoDate('2026-08-21'))).toBe(5)
    expect(weekdayOf(isoDate('2026-08-22'))).toBe(6)
    expect(weekdayOf(isoDate('2026-08-23'))).toBe(7)
  })
})

describe('addDays', () => {
  it('moves forwards and backwards', () => {
    expect(addDays(isoDate('2026-08-21'), 1)).toBe('2026-08-22')
    expect(addDays(isoDate('2026-08-21'), -1)).toBe('2026-08-20')
    expect(addDays(isoDate('2026-08-21'), 0)).toBe('2026-08-21')
  })

  it('crosses a month boundary', () => {
    expect(addDays(isoDate('2026-08-31'), 1)).toBe('2026-09-01')
    expect(addDays(isoDate('2026-09-01'), -1)).toBe('2026-08-31')
  })

  it('crosses a year boundary', () => {
    expect(addDays(isoDate('2026-12-31'), 1)).toBe('2027-01-01')
    expect(addDays(isoDate('2026-01-01'), -1)).toBe('2025-12-31')
  })

  it('never skips or repeats a day across a daylight saving transition', () => {
    // Calendar arithmetic has no offset to be wrong about; this is why the
    // design keeps zone handling to `toIsoDate` alone.
    expect(addDays(isoDate('2026-03-07'), 1)).toBe('2026-03-08')
    expect(addDays(isoDate('2026-03-08'), 1)).toBe('2026-03-09')
    expect(addDays(isoDate('2026-11-01'), 1)).toBe('2026-11-02')
  })

  it('spans a whole week', () => {
    expect(addDays(isoDate('2026-08-17'), 7)).toBe('2026-08-24')
  })
})

describe('startOfWeek', () => {
  it('returns the Monday of the containing week', () => {
    expect(startOfWeek(isoDate('2026-08-17'))).toBe('2026-08-17')
    expect(startOfWeek(isoDate('2026-08-21'))).toBe('2026-08-17')
    expect(startOfWeek(isoDate('2026-08-23'))).toBe('2026-08-17')
  })

  it('reaches back into the previous month', () => {
    // 2026-09-01 is a Tuesday, so its week starts in August.
    expect(startOfWeek(isoDate('2026-09-01'))).toBe('2026-08-31')
  })
})

describe('startOfMonth', () => {
  it('returns the first day of the containing month', () => {
    expect(startOfMonth(isoDate('2026-08-21'))).toBe('2026-08-01')
    expect(startOfMonth(isoDate('2026-08-01'))).toBe('2026-08-01')
  })
})

describe('endOfMonth', () => {
  it('handles a 31-day month', () => {
    expect(endOfMonth(isoDate('2026-08-21'))).toBe('2026-08-31')
  })

  it('handles a 30-day month', () => {
    expect(endOfMonth(isoDate('2026-09-10'))).toBe('2026-09-30')
  })

  it('handles February in and out of a leap year', () => {
    expect(endOfMonth(isoDate('2026-02-10'))).toBe('2026-02-28')
    expect(endOfMonth(isoDate('2024-02-10'))).toBe('2024-02-29')
  })

  it('handles December, which rolls the year', () => {
    expect(endOfMonth(isoDate('2026-12-10'))).toBe('2026-12-31')
  })
})

describe('datesBetween', () => {
  it('includes both ends', () => {
    expect(datesBetween(isoDate('2026-08-19'), isoDate('2026-08-21'))).toEqual([
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
    ])
  })

  it('returns a single date when both ends are the same day', () => {
    expect(datesBetween(isoDate('2026-08-21'), isoDate('2026-08-21'))).toEqual(['2026-08-21'])
  })

  it('returns nothing when the range is inverted', () => {
    expect(datesBetween(isoDate('2026-08-21'), isoDate('2026-08-19'))).toEqual([])
  })

  it('spans a month boundary', () => {
    expect(datesBetween(isoDate('2026-08-30'), isoDate('2026-09-02'))).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ])
  })
})
