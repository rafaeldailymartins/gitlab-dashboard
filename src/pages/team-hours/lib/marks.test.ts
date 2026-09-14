import { describe, expect, it } from 'vitest'

import type { GridColumn } from '@/entities/group-timelogs'

import { datesBetween, isoDate, weekdayOf } from '@/shared/lib/date'

import { dividerFor, marksOf } from './marks'

const SATURDAY = 6
const FULL_DAY = 8

/** May 2026 as day columns, the shape `columnsOf` produces for a month. */
const DAYS: GridColumn[] = datesBetween(isoDate('2026-05-01'), isoDate('2026-05-31')).map(
  (date) => ({
    from: date,
    key: date,
    referenceHours: weekdayOf(date) >= SATURDAY ? 0 : FULL_DAY,
    to: date,
  }),
)

/** The same month as week columns, each clipped to it. */
const WEEKS: GridColumn[] = [
  { from: isoDate('2026-05-01'), key: '2026-W18', referenceHours: 8, to: isoDate('2026-05-03') },
  { from: isoDate('2026-05-04'), key: '2026-W19', referenceHours: 40, to: isoDate('2026-05-10') },
  { from: isoDate('2026-05-11'), key: '2026-W20', referenceHours: 40, to: isoDate('2026-05-17') },
]

describe('marksOf', () => {
  it('finds the column a day falls in', () => {
    expect(marksOf(DAYS, isoDate('2026-05-12')).today).toBe('2026-05-12')
  })

  it('finds the week column a day falls in, so a week can be marked too', () => {
    expect(marksOf(WEEKS, isoDate('2026-05-12')).today).toBe('2026-W20')
  })

  it('marks no column when the period is not the one today is in', () => {
    expect(marksOf(DAYS, isoDate('2026-06-15')).today).toBe('')
  })

  it('closes a week on its last day', () => {
    // 3 May 2026 is a Sunday, and 4 May opens the week after it.
    const { weekEnds } = marksOf(DAYS, isoDate('2026-05-12'))

    expect(weekEnds.has('2026-05-03')).toBe(true)
    expect(weekEnds.has('2026-05-04')).toBe(false)
  })

  it('closes no week on the last column, which already has the table’s edge', () => {
    expect(marksOf(DAYS, isoDate('2026-05-12')).weekEnds.has('2026-05-31')).toBe(false)
  })
})

describe('dividerFor', () => {
  const marks = marksOf(DAYS, isoDate('2026-05-12'))

  it('bounds today’s column on both sides', () => {
    expect(dividerFor('2026-05-12', marks, false)).toContain('border-x')
  })

  it('bounds today’s column even when it is the last one', () => {
    expect(dividerFor('2026-05-12', marks, true)).toContain('border-x')
  })

  it('divides one week from the next at full strength', () => {
    expect(dividerFor('2026-05-03', marks, false)).toBe('border-r border-border')
  })

  it('divides days inside a week faintly', () => {
    expect(dividerFor('2026-05-05', marks, false)).toBe('border-r border-border/50')
  })

  it('draws nothing against the last column of the period', () => {
    expect(dividerFor('2026-05-31', marks, true)).toBe('')
  })
})
