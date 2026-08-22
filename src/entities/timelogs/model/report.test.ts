import { describe, expect, it } from 'vitest'

import { isoDate } from '@/shared/lib/date'

import type { TimelogPage } from './ports'
import type { TimelogEntry } from './types'

import { periodSummary, reportFrom } from './report'

const SAO_PAULO = 'America/Sao_Paulo'

const PROJECT = {
  fullPath: 'invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
  name: 'invent.fiscal.inventariofiscal',
  webUrl: 'https://gitlab.com/invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
}

function entry(day: string, seconds = 3600): TimelogEntry {
  return {
    project: PROJECT,
    seconds,
    spentAt: new Date(`${day}T15:00:00Z`),
    summary: null,
    workItem: null,
  }
}

function page(entries: TimelogEntry[], nextCursor: null | string = null): TimelogPage {
  return { entries, nextCursor }
}

const AUGUST = { from: isoDate('2026-08-01'), to: isoDate('2026-08-31') }

describe('reportFrom', () => {
  it('reports nothing loaded as not yet complete', () => {
    expect(reportFrom([], SAO_PAULO)).toEqual({
      complete: false,
      days: [],
      oldestLoadedDate: null,
    })
  })

  it('reports an account with no entries as complete and empty', () => {
    expect(reportFrom([page([])], SAO_PAULO)).toEqual({
      complete: true,
      days: [],
      oldestLoadedDate: null,
    })
  })

  it('groups the loaded pages into days, newest first', () => {
    const report = reportFrom(
      [page([entry('2026-08-21'), entry('2026-08-20')]), page([entry('2026-08-19')])],
      SAO_PAULO,
    )

    expect(report.days.map((day) => day.date)).toEqual(['2026-08-21', '2026-08-20', '2026-08-19'])
  })

  it('joins a day split across two pages into one day', () => {
    const report = reportFrom(
      [page([entry('2026-08-20', 3600)], 'older'), page([entry('2026-08-20', 1800)])],
      SAO_PAULO,
    )

    expect(report.days).toHaveLength(1)
    expect(report.days[0]?.seconds).toBe(5400)
  })

  it('groups in the reader time zone, not in UTC', () => {
    const entries = [{ ...entry('2026-08-21'), spentAt: new Date('2026-08-21T02:00:00Z') }]

    expect(reportFrom([page(entries)], SAO_PAULO).days[0]?.date).toBe('2026-08-20')
    expect(reportFrom([page(entries)], 'UTC').days[0]?.date).toBe('2026-08-21')
  })

  it('is complete when the last page has nothing older', () => {
    expect(reportFrom([page([entry('2026-08-20')], null)], SAO_PAULO).complete).toBe(true)
  })

  it('is incomplete while the last page points at older entries', () => {
    expect(reportFrom([page([entry('2026-08-20')], 'older')], SAO_PAULO).complete).toBe(false)
  })

  it('reports the oldest day it has loaded, not the second one', () => {
    const report = reportFrom(
      [page([entry('2026-08-21'), entry('2026-08-05'), entry('2026-07-01')], 'older')],
      SAO_PAULO,
    )

    expect(report.oldestLoadedDate).toBe('2026-07-01')
  })
})

describe('periodSummary', () => {
  it('totals only the days inside the period', () => {
    const report = reportFrom(
      [page([entry('2026-09-01', 7200), entry('2026-08-20', 3600), entry('2026-07-31', 1800)])],
      SAO_PAULO,
    )

    expect(periodSummary(report, AUGUST)).toMatchObject({
      entryCount: 1,
      hours: 1,
      seconds: 3600,
    })
  })

  it('includes the first and the last day of the period', () => {
    const report = reportFrom([page([entry('2026-08-01'), entry('2026-08-31')])], SAO_PAULO)

    expect(periodSummary(report, AUGUST).entryCount).toBe(2)
  })

  it('reads an empty period as zero rather than as missing', () => {
    const report = reportFrom([page([entry('2026-09-05')])], SAO_PAULO)

    expect(periodSummary(report, AUGUST)).toMatchObject({ entryCount: 0, hours: 0, seconds: 0 })
  })

  it('sums in seconds, so rounding never compounds across days', () => {
    const report = reportFrom(
      [page([entry('2026-08-20', 100), entry('2026-08-21', 100), entry('2026-08-22', 100)])],
      SAO_PAULO,
    )

    // Three days of 0.03 h each would read as 0.09 h if rounded first.
    expect(periodSummary(report, AUGUST).hours).toBe(0.08)
  })

  it('is settled once the whole history is loaded', () => {
    const report = reportFrom([page([entry('2026-08-20')], null)], SAO_PAULO)

    expect(periodSummary(report, AUGUST).settled).toBe(true)
  })

  it('is settled once loaded history reaches past the start of the period', () => {
    const report = reportFrom(
      [page([entry('2026-08-20'), entry('2026-07-31')], 'older')],
      SAO_PAULO,
    )

    expect(periodSummary(report, AUGUST).settled).toBe(true)
  })

  it('is unsettled while older entries could still fall inside the period', () => {
    const report = reportFrom(
      [page([entry('2026-08-20'), entry('2026-08-05')], 'older')],
      SAO_PAULO,
    )

    expect(periodSummary(report, AUGUST).settled).toBe(false)
  })

  it('is unsettled when the oldest loaded day is the first day of the period', () => {
    // A page boundary can fall inside a day, so that day may itself be partial.
    const report = reportFrom([page([entry('2026-08-01')], 'older')], SAO_PAULO)

    expect(periodSummary(report, AUGUST).settled).toBe(false)
  })

  it('is unsettled before anything has loaded', () => {
    expect(periodSummary(reportFrom([], SAO_PAULO), AUGUST).settled).toBe(false)
  })
})
