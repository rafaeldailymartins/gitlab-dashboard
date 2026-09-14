import { describe, expect, it } from 'vitest'

import {
  addDays,
  datesBetween,
  endOfMonth,
  endOfWeek,
  isoDate,
  isoWeekOf,
  isoWeekYearOf,
  isValidTimeZone,
  spanInstantsIn,
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

  it('gives the same answer when asked again, from the remembered one', () => {
    expect(isValidTimeZone(TOKYO)).toBe(true)
    expect(isValidTimeZone(TOKYO)).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
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

describe('endOfWeek', () => {
  it('returns the Sunday of the week', () => {
    // 2026-05-13 is a Wednesday.
    expect(endOfWeek(isoDate('2026-05-13'))).toBe('2026-05-17')
  })

  it('leaves a Sunday where it is', () => {
    expect(endOfWeek(isoDate('2026-05-17'))).toBe('2026-05-17')
  })

  it('crosses a month boundary', () => {
    expect(endOfWeek(isoDate('2026-04-30'))).toBe('2026-05-03')
  })
})

describe('isoWeekOf', () => {
  it('numbers the weeks of a month', () => {
    expect(isoWeekOf(isoDate('2026-05-01'))).toBe(18)
    expect(isoWeekOf(isoDate('2026-05-04'))).toBe(19)
    expect(isoWeekOf(isoDate('2026-05-25'))).toBe(22)
  })

  it('gives every day of one week the same number', () => {
    expect(
      datesBetween(isoDate('2026-05-04'), isoDate('2026-05-10')).map((date) => isoWeekOf(date)),
    ).toEqual([19, 19, 19, 19, 19, 19, 19])
  })
})

describe('isoWeekYearOf', () => {
  it('agrees with the calendar year in the middle of a year', () => {
    expect(isoWeekYearOf(isoDate('2026-05-12'))).toBe(2026)
  })

  it('puts the first days of January in the previous week-numbering year', () => {
    // 2027-01-01 is a Friday, so it belongs to week 53 of 2026.
    expect(isoWeekOf(isoDate('2027-01-01'))).toBe(53)
    expect(isoWeekYearOf(isoDate('2027-01-01'))).toBe(2026)
  })

  it('puts the last days of December in the next week-numbering year', () => {
    // 2025-12-29 is a Monday, so it opens week 1 of 2026.
    expect(isoWeekOf(isoDate('2025-12-29'))).toBe(1)
    expect(isoWeekYearOf(isoDate('2025-12-29'))).toBe(2026)
  })
})

describe('spanInstantsIn', () => {
  it('opens a day at its own first instant in the reader’s zone', () => {
    const span = spanInstantsIn(isoDate('2026-09-14'), isoDate('2026-09-14'), 'America/Sao_Paulo')

    expect(span.from).toBe('2026-09-14T03:00:00.000Z')
  })

  it('closes one microsecond before the next day opens', () => {
    const span = spanInstantsIn(isoDate('2026-09-14'), isoDate('2026-09-14'), 'America/Sao_Paulo')

    expect(span.to).toBe('2026-09-15T02:59:59.999999Z')
  })

  it('spans a run of days from the first to the last', () => {
    const span = spanInstantsIn(isoDate('2026-09-14'), isoDate('2026-09-20'), 'UTC')

    expect(span).toEqual({
      from: '2026-09-14T00:00:00.000Z',
      to: '2026-09-20T23:59:59.999999Z',
    })
  })

  it('leaves no gap and no overlap between one day and the next', () => {
    const monday = spanInstantsIn(isoDate('2026-09-14'), isoDate('2026-09-14'), 'Asia/Tokyo')
    const tuesday = spanInstantsIn(isoDate('2026-09-15'), isoDate('2026-09-15'), 'Asia/Tokyo')

    // A microsecond apart: adjacent, and sharing no instant. Both of GitLab's
    // bounds are inclusive, so a shared instant would be counted twice.
    expect(Date.parse(tuesday.from) - Date.parse(monday.to.replace('999999', '999'))).toBe(1)
  })

  it('opens a day whose local midnight the zone skipped over', () => {
    // São Paulo advanced its clocks at midnight every spring until 2019, so
    // 2018-11-04 has no 00:00 at all. Constructing one would ask for a time
    // that never happened; the day in fact began at 01:00.
    const span = spanInstantsIn(isoDate('2018-11-04'), isoDate('2018-11-04'), 'America/Sao_Paulo')

    expect(toIsoDate(new Date(span.from), 'America/Sao_Paulo')).toBe('2018-11-04')
    expect(toIsoDate(new Date(Date.parse(span.from) - 1), 'America/Sao_Paulo')).toBe('2018-11-03')
  })

  it('agrees with the day an instant is bucketed into, at both ends', () => {
    const zone = 'Pacific/Kiritimati'
    const span = spanInstantsIn(isoDate('2026-09-14'), isoDate('2026-09-14'), zone)

    expect(toIsoDate(new Date(span.from), zone)).toBe('2026-09-14')
    expect(toIsoDate(new Date(Date.parse(span.to.replace('999999', '999'))), zone)).toBe(
      '2026-09-14',
    )
  })
})
