import { describe, expect, it } from 'vitest'

import type { DayTotal } from '@/entities/timelogs'

import { isoDate, type IsoDate } from '@/shared/lib/date'

import { monthGrid } from './month-grid'

const SECONDS_PER_HOUR = 3600
const WEEKDAYS_ONLY = { 1: 8, 2: 8, 3: 8, 4: 8, 5: 8, 6: 0, 7: 0 }

/** August 2026 starts on a Saturday and has 31 days. */
const AUGUST = isoDate('2026-08-15')

function cellFor(grid: ReturnType<typeof monthGrid>, date: IsoDate) {
  return cells(grid).find((cell) => cell.date === date)
}

function cells(grid: ReturnType<typeof monthGrid>) {
  return grid.flat()
}

function day(date: string, hours: number): DayTotal {
  return {
    date: isoDate(date),
    entryCount: 1,
    hours,
    items: [],
    seconds: hours * SECONDS_PER_HOUR,
  }
}

describe('monthGrid', () => {
  it('lays the month out in whole weeks of seven', () => {
    const grid = monthGrid([], WEEKDAYS_ONLY, AUGUST)

    expect(grid.every((week) => week.length === 7)).toBe(true)
  })

  it('holds every day of the month and no day of another', () => {
    const dated = cells(monthGrid([], WEEKDAYS_ONLY, AUGUST)).filter((cell) => cell.date !== null)

    expect(dated).toHaveLength(31)
    expect(dated.at(0)?.date).toBe('2026-08-01')
    expect(dated.at(-1)?.date).toBe('2026-08-31')
  })

  it('pads the first week so the month starts on its own weekday', () => {
    // The 1st is a Saturday, so five padding cells lead the week.
    const [firstWeek] = monthGrid([], WEEKDAYS_ONLY, AUGUST)

    expect(firstWeek?.filter((cell) => cell.date === null)).toHaveLength(5)
    expect(firstWeek?.at(5)?.date).toBe('2026-08-01')
  })

  it('pads the last week too, so the grid stays rectangular', () => {
    const grid = monthGrid([], WEEKDAYS_ONLY, AUGUST)
    const lastWeek = grid.at(-1)

    expect(lastWeek?.at(-1)?.date).toBeNull()
  })

  it('gives a padding cell nothing to read: no date, no hours, no target', () => {
    const [firstWeek] = monthGrid([], WEEKDAYS_ONLY, AUGUST)

    expect(firstWeek?.at(0)).toEqual({ band: 0, date: null, hours: 0, isWorkingDay: false })
  })

  it('carries the hours of a day that has some', () => {
    const grid = monthGrid([day('2026-08-20', 6.7)], WEEKDAYS_ONLY, AUGUST)

    expect(cellFor(grid, isoDate('2026-08-20'))?.hours).toBe(6.7)
  })

  it('marks a working day with nothing logged as working and empty', () => {
    const grid = monthGrid([], WEEKDAYS_ONLY, AUGUST)

    expect(cellFor(grid, isoDate('2026-08-20'))).toMatchObject({ band: 0, isWorkingDay: true })
  })

  it('marks a weekend with nothing logged as neither working nor filled', () => {
    const grid = monthGrid([], WEEKDAYS_ONLY, AUGUST)

    expect(cellFor(grid, isoDate('2026-08-22'))).toMatchObject({ band: 0, isWorkingDay: false })
  })

  it('reads a full day against its own target as the top band', () => {
    const grid = monthGrid([day('2026-08-20', 8)], WEEKDAYS_ONLY, AUGUST)

    expect(cellFor(grid, isoDate('2026-08-20'))?.band).toBe(4)
  })

  it('reads a day past its target as the top band, not past it', () => {
    const grid = monthGrid([day('2026-08-20', 14)], WEEKDAYS_ONLY, AUGUST)

    expect(cellFor(grid, isoDate('2026-08-20'))?.band).toBe(4)
  })

  it('spreads part days across the bands between', () => {
    const grid = monthGrid(
      [day('2026-08-18', 1), day('2026-08-19', 4), day('2026-08-20', 6)],
      WEEKDAYS_ONLY,
      AUGUST,
    )

    expect(cellFor(grid, isoDate('2026-08-18'))?.band).toBe(1)
    expect(cellFor(grid, isoDate('2026-08-19'))?.band).toBe(2)
    expect(cellFor(grid, isoDate('2026-08-20'))?.band).toBe(3)
  })

  it('measures a day against its own target, not against a fixed eight', () => {
    const grid = monthGrid([day('2026-08-19', 4)], { ...WEEKDAYS_ONLY, 3: 4 }, AUGUST)

    // Four hours is a full day when the target for that weekday is four.
    expect(cellFor(grid, isoDate('2026-08-19'))?.band).toBe(4)
  })

  it('measures a day with no target against a nominal full day', () => {
    const grid = monthGrid([day('2026-08-22', 8)], WEEKDAYS_ONLY, AUGUST)

    expect(cellFor(grid, isoDate('2026-08-22'))?.band).toBe(4)
  })

  it('ignores days outside the month it was asked for', () => {
    const grid = monthGrid([day('2026-07-20', 8)], WEEKDAYS_ONLY, AUGUST)

    expect(cells(grid).every((cell) => cell.hours === 0)).toBe(true)
  })

  it('starts a month that begins on a Monday with no padding at all', () => {
    // June 2026 begins on a Monday.
    const [firstWeek] = monthGrid([], WEEKDAYS_ONLY, isoDate('2026-06-10'))

    expect(firstWeek?.at(0)?.date).toBe('2026-06-01')
  })
})
