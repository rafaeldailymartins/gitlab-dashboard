import { describe, expect, it } from 'vitest'
import { ANA, BRUNO, entry, member, SQUAD_FISCAL } from '~tests/support/gitlab-group-timelogs'

import { isoDate } from '@/shared/lib/date'

import type { GroupHoursPage, GroupProbe } from './ports'
import type { ReportOptions } from './report'

import { groupReportFrom } from './report'
import { REFERENCE_SCHEDULE } from './types'
import { readerWindow } from './window'

const WINDOW = readerWindow(isoDate('2026-05-12'))
const HOURS_46 = 167_400

function options(overrides: Partial<ReportOptions> = {}): ReportOptions {
  return {
    granularity: 'days',
    probe: null,
    reference: REFERENCE_SCHEDULE,
    roster: [member(ANA)],
    timeZone: 'UTC',
    today: isoDate('2026-06-15'),
    window: WINDOW,
    ...overrides,
  }
}

function page(overrides: Partial<GroupHoursPage> = {}): GroupHoursPage {
  return { entries: [], group: SQUAD_FISCAL, nextCursor: null, ...overrides }
}

function probe(overrides: Partial<GroupProbe> = {}): GroupProbe {
  return {
    access: { level: 20, name: 'REPORTER' },
    declared: { entryCount: 1, seconds: HOURS_46 },
    group: SQUAD_FISCAL,
    perPerson: new Map(),
    ...overrides,
  }
}

describe('groupReportFrom, what the provider declared', () => {
  it('takes the window totals from the probe rather than from the pages', () => {
    // The pages carry what arrived; only the probe carries what exists. The
    // difference between them is the whole withheld instrument.
    const report = groupReportFrom([page()], options({ probe: probe() }))

    expect(report.declared).toEqual({ entryCount: 1, seconds: HOURS_46 })
  })

  it('declares nothing when the probe has not answered', () => {
    expect(groupReportFrom([page()], options()).declared).toEqual({ entryCount: 0, seconds: 0 })
  })
})

describe('groupReportFrom, completeness', () => {
  it('cuts the month from the widened window before building the grid', () => {
    const entries = [
      entry(ANA, '2026-04-30T09:00:00Z', 3600),
      entry(ANA, '2026-05-04T09:00:00Z', 7200),
    ]
    const report = groupReportFrom([page({ entries })], options())

    expect(report.grid.grandTotal.seconds).toBe(7200)
    expect(report.visible.seconds).toBe(10_800)
  })

  it('gives a member who logged nothing a row', () => {
    const report = groupReportFrom([page()], options({ roster: [member(ANA), member(BRUNO)] }))

    expect(report.grid.rows.map((row) => row.person.username)).toEqual([
      ANA.username,
      BRUNO.username,
    ])
  })
})
