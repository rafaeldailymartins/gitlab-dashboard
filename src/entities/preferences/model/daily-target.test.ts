import { describe, expect, it } from 'vitest'

import { isoDate } from '@/shared/lib/date'

import {
  dailyTargetFrom,
  DEFAULT_DAILY_TARGET,
  isValidTargetHours,
  MAX_TARGET_HOURS,
  targetForDate,
  targetForDates,
  targetProgress,
  withWeekdayTarget,
} from './daily-target'

const MONDAY = isoDate('2026-08-17')
const FRIDAY = isoDate('2026-08-21')
const SATURDAY = isoDate('2026-08-22')
const SUNDAY = isoDate('2026-08-23')

const WORKING_WEEK = [
  MONDAY,
  isoDate('2026-08-18'),
  isoDate('2026-08-19'),
  isoDate('2026-08-20'),
  FRIDAY,
  SATURDAY,
  SUNDAY,
]

describe('DEFAULT_DAILY_TARGET', () => {
  it('is eight hours on weekdays', () => {
    expect(DEFAULT_DAILY_TARGET[1]).toBe(8)
    expect(DEFAULT_DAILY_TARGET[5]).toBe(8)
  })

  it('is nothing at the weekend', () => {
    expect(DEFAULT_DAILY_TARGET[6]).toBe(0)
    expect(DEFAULT_DAILY_TARGET[7]).toBe(0)
  })
})

describe('isValidTargetHours', () => {
  it.each([0, 0.5, 8, 23.99, MAX_TARGET_HOURS])('accepts %o', (hours) => {
    expect(isValidTargetHours(hours)).toBe(true)
  })

  it.each([-0.1, -8, 24.01, 25, Number.NaN, Number.POSITIVE_INFINITY])('rejects %o', (hours) => {
    expect(isValidTargetHours(hours)).toBe(false)
  })
})

describe('targetForDate', () => {
  it('reads the target of the weekday the date falls on', () => {
    expect(targetForDate(DEFAULT_DAILY_TARGET, MONDAY)).toBe(8)
    expect(targetForDate(DEFAULT_DAILY_TARGET, FRIDAY)).toBe(8)
  })

  it('is zero on a day with no target', () => {
    expect(targetForDate(DEFAULT_DAILY_TARGET, SATURDAY)).toBe(0)
    expect(targetForDate(DEFAULT_DAILY_TARGET, SUNDAY)).toBe(0)
  })
})

describe('targetForDates', () => {
  it('sums the targets of a whole week', () => {
    expect(targetForDates(DEFAULT_DAILY_TARGET, WORKING_WEEK)).toBe(40)
  })

  it('is zero for no dates', () => {
    expect(targetForDates(DEFAULT_DAILY_TARGET, [])).toBe(0)
  })

  it('follows a customised week', () => {
    const shortFriday = withWeekdayTarget(DEFAULT_DAILY_TARGET, 5, 6)

    expect(targetForDates(shortFriday, WORKING_WEEK)).toBe(38)
  })
})

describe('withWeekdayTarget', () => {
  it('changes only the weekday given', () => {
    const changed = withWeekdayTarget(DEFAULT_DAILY_TARGET, 5, 6)

    expect(changed[5]).toBe(6)
    expect(changed[1]).toBe(8)
    expect(changed[6]).toBe(0)
  })

  it('leaves the original untouched', () => {
    withWeekdayTarget(DEFAULT_DAILY_TARGET, 5, 6)

    expect(DEFAULT_DAILY_TARGET[5]).toBe(8)
  })

  it('accepts zero and the daily maximum', () => {
    expect(withWeekdayTarget(DEFAULT_DAILY_TARGET, 1, 0)[1]).toBe(0)
    expect(withWeekdayTarget(DEFAULT_DAILY_TARGET, 1, MAX_TARGET_HOURS)[1]).toBe(24)
  })

  it.each([-1, 25, Number.NaN])('rejects %o rather than storing it', (hours) => {
    expect(() => withWeekdayTarget(DEFAULT_DAILY_TARGET, 1, hours)).toThrow(RangeError)
  })

  it('explains the accepted range when it rejects', () => {
    expect(() => withWeekdayTarget(DEFAULT_DAILY_TARGET, 1, 25)).toThrow(/between 0 and 24/)
  })
})

describe('targetProgress', () => {
  it('reports a shortfall against a target', () => {
    const progress = targetProgress(4, 8)

    expect(progress).toMatchObject({
      balanceHours: -4,
      isMet: false,
      loggedHours: 4,
      ratio: 0.5,
      targetHours: 8,
    })
  })

  it('reports a target met exactly', () => {
    const progress = targetProgress(8, 8)

    expect(progress.isMet).toBe(true)
    expect(progress.ratio).toBe(1)
    expect(progress.balanceHours).toBe(0)
  })

  it('clamps the ratio but keeps the surplus in the balance', () => {
    const progress = targetProgress(10, 8)

    expect(progress.ratio).toBe(1)
    expect(progress.balanceHours).toBe(2)
    expect(progress.isMet).toBe(true)
  })

  it('treats time logged against no target as above target, not a shortfall', () => {
    const progress = targetProgress(2, 0)

    expect(progress.ratio).toBeNull()
    expect(progress.balanceHours).toBe(2)
    expect(progress.isMet).toBe(true)
  })

  it('has nothing to measure when neither hours nor target exist', () => {
    const progress = targetProgress(0, 0)

    expect(progress.ratio).toBeNull()
    expect(progress.balanceHours).toBe(0)
    expect(progress.isMet).toBe(true)
  })

  it('reports nothing logged against a target as a full shortfall', () => {
    const progress = targetProgress(0, 8)

    expect(progress.ratio).toBe(0)
    expect(progress.balanceHours).toBe(-8)
    expect(progress.isMet).toBe(false)
  })
})

describe('dailyTargetFrom', () => {
  it('reads a complete stored target', () => {
    const stored = { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 2, 7: 0 }

    expect(dailyTargetFrom(stored)).toEqual(stored)
  })

  it('keeps the values it can use and defaults the rest', () => {
    const target = dailyTargetFrom({ 1: 6, 2: 'six', 3: -1, 4: 99 })

    expect(target[1]).toBe(6)
    expect(target[2]).toBe(8)
    expect(target[3]).toBe(8)
    expect(target[4]).toBe(8)
    expect(target[6]).toBe(0)
  })

  it.each([null, undefined, 42, 'preferences', true])(
    'falls back to the default target for %o',
    (source) => {
      expect(dailyTargetFrom(source)).toEqual(DEFAULT_DAILY_TARGET)
    },
  )

  it('ignores keys that are not weekdays', () => {
    const target = dailyTargetFrom({ 0: 5, 8: 5, monday: 5 })

    expect(target).toEqual(DEFAULT_DAILY_TARGET)
  })

  it('reads an array as the empty object it effectively is', () => {
    expect(dailyTargetFrom([1, 2, 3])).toEqual(DEFAULT_DAILY_TARGET)
  })
})
