import { describe, expect, it } from 'vitest'
import { EIGHT_BY_FIVE } from '~tests/support/gitlab-team-timelogs'

import { isoDate } from '@/shared/lib/date'

import { columnsOf, weekBandsOf } from './columns'

// May 2026 begins on a Friday, so its first ISO week is a three-day stub.
const MAY = { from: isoDate('2026-05-01'), to: isoDate('2026-05-31') }
const REFERENCE = EIGHT_BY_FIVE

describe('columnsOf, by days', () => {
  const columns = columnsOf(MAY, 'days', REFERENCE)

  it('gives one column per day of the month', () => {
    expect(columns).toHaveLength(31)
    expect(columns[0]?.key).toBe('2026-05-01')
    expect(columns.at(-1)?.key).toBe('2026-05-31')
  })

  it('spans a single day per column', () => {
    expect(columns[0]?.from).toBe(columns[0]?.to)
  })

  it('expects a working day’s hours and nothing at the weekend', () => {
    // 1 May is a Friday, 2 May a Saturday, 3 May a Sunday, 4 May a Monday.
    expect(columns[0]?.referenceHours).toBe(8)
    expect(columns[1]?.referenceHours).toBe(0)
    expect(columns[2]?.referenceHours).toBe(0)
    expect(columns[3]?.referenceHours).toBe(8)
  })

  it('handles a month that begins on a Monday', () => {
    const june = columnsOf(
      { from: isoDate('2026-06-01'), to: isoDate('2026-06-30') },
      'days',
      REFERENCE,
    )

    expect(june).toHaveLength(30)
    expect(june[0]?.referenceHours).toBe(8)
  })
})

describe('columnsOf, by weeks', () => {
  const columns = columnsOf(MAY, 'weeks', REFERENCE)

  it('gives one column per ISO week the month touches', () => {
    expect(columns.map((column) => column.key)).toEqual([
      '2026-W18',
      '2026-W19',
      '2026-W20',
      '2026-W21',
      '2026-W22',
    ])
  })

  it('clips the first week to the days that fall inside the month', () => {
    expect(columns[0]?.from).toBe('2026-05-01')
    expect(columns[0]?.to).toBe('2026-05-03')
  })

  it('clips the last week to the end of the month', () => {
    expect(columns.at(-1)?.to).toBe('2026-05-31')
  })

  it('expects only what the clipped week actually contains', () => {
    // 1–3 May is one working day; 4–10 May is five.
    expect(columns[0]?.referenceHours).toBe(8)
    expect(columns[1]?.referenceHours).toBe(40)
  })

  it('names a January week by its week-numbering year, not its calendar one', () => {
    const january = columnsOf(
      { from: isoDate('2027-01-01'), to: isoDate('2027-01-31') },
      'weeks',
      REFERENCE,
    )

    // 1 January 2027 is a Friday: week 53 of the week-numbering year 2026.
    expect(january[0]?.key).toBe('2026-W53')
  })
})

describe('weekBandsOf', () => {
  const bands = weekBandsOf(columnsOf(MAY, 'days', REFERENCE), 'days')

  it('bands the days of the month into its ISO weeks', () => {
    expect(bands.map((band) => band.isoWeek)).toEqual([18, 19, 20, 21, 22])
  })

  it('spans only the days of a partial week that fall in the month', () => {
    expect(bands[0]).toMatchObject({ columnCount: 3, from: '2026-05-01', to: '2026-05-03' })
  })

  it('spans a whole week where the month contains one', () => {
    expect(bands[1]).toMatchObject({ columnCount: 7, from: '2026-05-04', to: '2026-05-10' })
  })

  it('carries the week-numbering year', () => {
    expect(bands[0]?.isoWeekYear).toBe(2026)

    const january = weekBandsOf(
      columnsOf({ from: isoDate('2027-01-01'), to: isoDate('2027-01-31') }, 'days', REFERENCE),
      'days',
    )

    expect(january[0]).toMatchObject({ isoWeek: 53, isoWeekYear: 2026 })
  })

  it('bands nothing under week columns, where every column is already a week', () => {
    expect(weekBandsOf(columnsOf(MAY, 'weeks', REFERENCE), 'weeks')).toEqual([])
  })

  it('accounts for every column exactly once', () => {
    expect(bands.reduce((sum, band) => sum + band.columnCount, 0)).toBe(31)
  })
})
