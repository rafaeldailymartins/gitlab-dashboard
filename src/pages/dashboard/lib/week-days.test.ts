import { describe, expect, it } from 'vitest'

import type { DayTotal } from '@/entities/timelogs'

import { isoDate } from '@/shared/lib/date'

import { weekDays } from './week-days'

/** Monday to Sunday, 17–23 August 2026. The 21st is a Friday. */
const FRIDAY = isoDate('2026-08-21')
const WEEKDAYS_ONLY = { 1: 8, 2: 8, 3: 8, 4: 8, 5: 8, 6: 0, 7: 0 }

function day(date: string, hours: number): DayTotal {
  return {
    date: isoDate(date),
    entryCount: 1,
    hours,
    items: [],
    seconds: hours * 3600,
  }
}

describe('weekDays', () => {
  it('covers Monday to Sunday of the week the day falls in', () => {
    const week = weekDays([], WEEKDAYS_ONLY, FRIDAY)

    expect(week).toHaveLength(7)
    expect(week.at(0)?.date).toBe('2026-08-17')
    expect(week.at(-1)?.date).toBe('2026-08-23')
  })

  it('keeps a day with nothing logged, at zero', () => {
    const week = weekDays([day('2026-08-17', 8)], WEEKDAYS_ONLY, FRIDAY)

    expect(week.at(1)).toMatchObject({ date: '2026-08-18', hours: 0 })
  })

  it('carries the hours of each day it was given', () => {
    const week = weekDays([day('2026-08-19', 6.7)], WEEKDAYS_ONLY, FRIDAY)

    expect(week.at(2)?.hours).toBe(6.7)
  })

  it('ignores days outside the week', () => {
    const week = weekDays([day('2026-08-10', 8)], WEEKDAYS_ONLY, FRIDAY)

    expect(week.every((column) => column.hours === 0)).toBe(true)
  })

  it('marks today, and only today', () => {
    const week = weekDays([], WEEKDAYS_ONLY, FRIDAY)

    expect(week.filter((column) => column.isToday).map((column) => column.date)).toEqual([FRIDAY])
  })

  it('carries the target for each weekday, weekend included', () => {
    const week = weekDays([], WEEKDAYS_ONLY, FRIDAY)

    expect(week.map((column) => column.targetHours)).toEqual([8, 8, 8, 8, 8, 0, 0])
  })

  it('numbers the weekdays from Monday', () => {
    expect(weekDays([], WEEKDAYS_ONLY, FRIDAY).map((column) => column.weekday)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ])
  })

  it('scales the tallest bar of an ordinary week to the target', () => {
    const week = weekDays([day('2026-08-17', 8), day('2026-08-18', 4)], WEEKDAYS_ONLY, FRIDAY)

    expect(week.at(0)?.ratio).toBe(1)
    expect(week.at(1)?.ratio).toBe(0.5)
  })

  it('keeps a day above target inside the strip', () => {
    const week = weekDays([day('2026-08-17', 12), day('2026-08-18', 6)], WEEKDAYS_ONLY, FRIDAY)

    expect(week.at(0)?.ratio).toBe(1)
    expect(week.at(1)?.ratio).toBe(0.5)
  })

  it('does not stretch a quiet week to look full', () => {
    const week = weekDays([day('2026-08-17', 1)], WEEKDAYS_ONLY, FRIDAY)

    expect(week.at(0)?.ratio).toBeCloseTo(0.125)
  })

  it('has nothing to scale when there is no target and no time', () => {
    const week = weekDays([], { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }, FRIDAY)

    expect(week.every((column) => column.ratio === 0)).toBe(true)
  })
})

describe('weekDays target scale', () => {
  it('puts the target on the same scale as the bars', () => {
    const week = weekDays([day('2026-08-17', 8)], WEEKDAYS_ONLY, FRIDAY)

    // Eight logged against an eight-hour target: the bar reaches the line.
    expect(week.at(0)?.ratio).toBe(week.at(0)?.targetRatio)
  })

  it('keeps the target visible on a day with nothing logged', () => {
    const week = weekDays([day('2026-08-17', 8)], WEEKDAYS_ONLY, FRIDAY)

    expect(week.at(1)).toMatchObject({ hours: 0, ratio: 0, targetRatio: 1 })
  })

  it('leaves a weekend without a target line', () => {
    const week = weekDays([day('2026-08-17', 8)], WEEKDAYS_ONLY, FRIDAY)

    expect(week.at(5)?.targetRatio).toBe(0)
  })

  it('drops the target below the top once a day goes past it', () => {
    const week = weekDays([day('2026-08-17', 16)], WEEKDAYS_ONLY, FRIDAY)

    expect(week.at(0)?.ratio).toBe(1)
    expect(week.at(0)?.targetRatio).toBe(0.5)
  })

  it('has no target to place when there is neither time nor target', () => {
    const week = weekDays([], { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }, FRIDAY)

    expect(week.every((column) => column.targetRatio === 0)).toBe(true)
  })
})
