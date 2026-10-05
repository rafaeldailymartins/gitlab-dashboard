import { describe, expect, it } from 'vitest'

import { isoDate } from '@/shared/lib/date'

import type { TimelogPage } from './ports'
import type { TimelogEntry } from './types'

import { periodsOf, periodSummaries } from './periods'
import { reportFrom } from './report'

const UTC = 'UTC'

function entry(day: string, seconds = 3600): TimelogEntry {
  return {
    project: null,
    seconds,
    spentAt: new Date(`${day}T12:00:00Z`),
    summary: null,
    workItem: null,
  }
}

function page(entries: TimelogEntry[], nextCursor: null | string = null): TimelogPage {
  return { entries, nextCursor }
}

describe('periodsOf', () => {
  it('names the day, its Monday-to-Sunday week and its calendar month', () => {
    expect(periodsOf(isoDate('2026-08-19'))).toEqual({
      day: { from: '2026-08-19', to: '2026-08-19' },
      month: { from: '2026-08-01', to: '2026-08-31' },
      week: { from: '2026-08-17', to: '2026-08-23' },
    })
  })

  it('lets a week run across the end of a month', () => {
    expect(periodsOf(isoDate('2026-10-02')).week).toEqual({
      from: '2026-09-28',
      to: '2026-10-04',
    })
  })
})

describe('periodSummaries', () => {
  it('totals each period of the day from the loaded days', () => {
    const report = reportFrom(
      [
        page([
          entry('2026-08-19', 7200),
          entry('2026-08-17', 3600),
          entry('2026-08-03', 1800),
          entry('2026-07-31', 900),
        ]),
      ],
      UTC,
    )

    const summaries = periodSummaries(report, isoDate('2026-08-19'))

    expect(summaries.day.hours).toBe(2)
    expect(summaries.week.hours).toBe(3)
    expect(summaries.month.hours).toBe(3.5)
  })

  it('is settled only once history reaches past the week as well as the month', () => {
    // The week of 2 October begins on 28 September: a page reaching back to the
    // 30th settles October and leaves that week a floor.
    const report = reportFrom([page([entry('2026-10-02'), entry('2026-09-30')], 'older')], UTC)

    const summaries = periodSummaries(report, isoDate('2026-10-02'))

    expect(summaries.month.settled).toBe(true)
    expect(summaries.week.settled).toBe(false)
    expect(summaries.settled).toBe(false)
  })

  it('is settled once history reaches past the earlier of the two starts', () => {
    const report = reportFrom([page([entry('2026-10-02'), entry('2026-09-27')], 'older')], UTC)

    expect(periodSummaries(report, isoDate('2026-10-02')).settled).toBe(true)
  })

  it('is not settled while the month began before the week and has not been reached', () => {
    const report = reportFrom([page([entry('2026-08-19'), entry('2026-08-16')], 'older')], UTC)

    const summaries = periodSummaries(report, isoDate('2026-08-19'))

    expect(summaries.week.settled).toBe(true)
    expect(summaries.settled).toBe(false)
  })
})
