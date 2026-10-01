import { describe, expect, it } from 'vitest'
import {
  ANA,
  BRUNO,
  CAMILA,
  EIGHT_BY_FIVE,
  entry,
  member,
} from '~tests/support/gitlab-team-timelogs'

import { isoDate } from '@/shared/lib/date'

import type { MemberHours, TeamHoursPage } from './ports'
import type { ReportOptions } from './report'
import type { Person } from './types'

import { teamReportFrom } from './report'
import { readerWindow } from './window'

const WINDOW = readerWindow(isoDate('2026-05-12'))
const HOURS_46 = 167_400

/** One person's answer within one round, resolved and final unless told otherwise. */
function hours(person: Person, overrides: Partial<MemberHours> = {}): MemberHours {
  return { declared: null, entries: [], nextCursor: null, person, ...overrides }
}

function options(overrides: Partial<ReportOptions> = {}): ReportOptions {
  return {
    granularity: 'days',
    members: [member(ANA)],
    reference: EIGHT_BY_FIVE,
    timeZone: 'UTC',
    today: isoDate('2026-06-15'),
    window: WINDOW,
    ...overrides,
  }
}

function page(...members: readonly MemberHours[]): TeamHoursPage {
  return { members }
}

describe('teamReportFrom, what the provider declared', () => {
  it('adds up what the provider declared for each person', () => {
    const report = teamReportFrom(
      [
        page(
          hours(ANA, { declared: { entryCount: 1, seconds: HOURS_46 } }),
          hours(BRUNO, { declared: { entryCount: 2, seconds: 7200 } }),
        ),
      ],
      options({ members: [member(ANA), member(BRUNO)] }),
    )

    expect(report.declared).toEqual({ entryCount: 3, seconds: HOURS_46 + 7200 })
  })

  it('counts a person the provider declared nothing about as nothing, not as a gap', () => {
    const report = teamReportFrom(
      [page(hours(ANA, { declared: { entryCount: 1, seconds: 7200 } }), hours(BRUNO))],
      options({ members: [member(ANA), member(BRUNO)] }),
    )

    expect(report.declared).toEqual({ entryCount: 1, seconds: 7200 })
  })

  it('declares nothing when no round carried the aggregates', () => {
    expect(teamReportFrom([page(hours(ANA))], options()).declared).toEqual({
      entryCount: 0,
      seconds: 0,
    })
  })

  it('keeps the first round’s aggregates when a later round carries none', () => {
    // They are window-wide, so asking again would return the same number at a
    // later instant — and an aggregate read later than the page it is compared
    // against can disagree for reasons that are not redaction.
    const report = teamReportFrom(
      [
        page(hours(ANA, { declared: { entryCount: 2, seconds: HOURS_46 }, nextCursor: 'MQ' })),
        page(hours(ANA, { entries: [entry('2026-05-04T09:00:00Z', 7200)] })),
      ],
      options(),
    )

    expect(report.declared).toEqual({ entryCount: 2, seconds: HOURS_46 })
  })
})

describe('teamReportFrom, the window and the month', () => {
  it('cuts the month from the widened window before building the grid', () => {
    const report = teamReportFrom(
      [
        page(
          hours(ANA, {
            entries: [entry('2026-04-30T09:00:00Z', 3600), entry('2026-05-04T09:00:00Z', 7200)],
          }),
        ),
      ],
      options(),
    )

    expect(report.grid.grandTotal.seconds).toBe(7200)
    expect(report.visible.seconds).toBe(10_800)
  })

  it('gathers every round a person appears in into one row', () => {
    const report = teamReportFrom(
      [
        page(hours(ANA, { entries: [entry('2026-05-04T09:00:00Z', 3600)], nextCursor: 'MQ' })),
        page(hours(ANA, { entries: [entry('2026-05-05T09:00:00Z', 7200)] })),
      ],
      options(),
    )

    expect(report.grid.rows[0]?.total.seconds).toBe(10_800)
  })

  it('keeps each person’s entries to their own row', () => {
    const report = teamReportFrom(
      [
        page(
          hours(ANA, { entries: [entry('2026-05-04T09:00:00Z', 3600)] }),
          hours(BRUNO, { entries: [entry('2026-05-04T09:00:00Z', 7200)] }),
        ),
      ],
      options({ members: [member(ANA), member(BRUNO)] }),
    )

    expect(report.grid.rows.map((row) => row.total.seconds)).toEqual([3600, 7200])
  })
})

describe('teamReportFrom, rows', () => {
  it('draws a row for every person the team names, in the order it names them', () => {
    const report = teamReportFrom(
      [page(hours(ANA))],
      options({ members: [member(BRUNO), member(ANA)] }),
    )

    expect(report.grid.rows.map((row) => row.member.username)).toEqual([
      BRUNO.username,
      ANA.username,
    ])
  })

  it('confirms whoever the provider resolved and leaves the rest unresolved', () => {
    const report = teamReportFrom(
      [page(hours(ANA))],
      options({ members: [member(ANA), member(CAMILA)] }),
    )

    expect(report.grid.rows[0]?.identity).toEqual({ kind: 'confirmed', person: ANA })
    expect(report.grid.rows[1]?.identity).toEqual({ kind: 'unresolved' })
  })

  it('confirms somebody the provider now calls something else', () => {
    // A rename is somebody changing their handle, not an error. The row shows
    // what the provider says now, and the hours are still theirs.
    const renamed = { ...ANA, username: 'ana.carolina' }
    const report = teamReportFrom([page(hours(renamed))], options())

    expect(report.grid.rows[0]?.identity).toEqual({ kind: 'confirmed', person: renamed })
  })
})

describe('teamReportFrom, completeness', () => {
  it('is complete when every person’s window has been read to its end', () => {
    const report = teamReportFrom(
      [page(hours(ANA, { declared: { entryCount: 0, seconds: 0 } }))],
      options(),
    )

    expect(report.complete).toBe(true)
    expect(report.shortfall).toEqual({ entryCount: 0, hours: 0, seconds: 0 })
  })

  it('withholds the team shortfall while anybody is still being read', () => {
    const report = teamReportFrom(
      [
        page(
          hours(ANA, { declared: { entryCount: 4, seconds: HOURS_46 }, nextCursor: 'MQ' }),
          hours(BRUNO, { declared: { entryCount: 0, seconds: 0 } }),
        ),
      ],
      options({ members: [member(ANA), member(BRUNO)] }),
    )

    expect(report.complete).toBe(false)
    expect(report.shortfall).toBeNull()
  })

  it('counts somebody the provider never resolved as settled', () => {
    // Nothing more is coming for them. Holding the report open on an answer
    // that will never arrive would mark every figure provisional forever.
    const report = teamReportFrom([page(hours(ANA))], options({ members: [member(CAMILA)] }))

    expect(report.complete).toBe(true)
  })

  it('reports the hours the provider counted over the team but did not show', () => {
    const report = teamReportFrom(
      [
        page(
          hours(ANA, {
            declared: { entryCount: 3, seconds: HOURS_46 },
            entries: [entry('2026-05-04T09:00:00Z', HOURS_46 - 45_000)],
          }),
        ),
      ],
      options(),
    )

    expect(report.shortfall).toMatchObject({ entryCount: 2, hours: 12.5, seconds: 45_000 })
  })
})

describe('teamReportFrom, each person’s own frontier', () => {
  it('reads a settled person’s month through to its end', () => {
    const report = teamReportFrom([page(hours(ANA))], options())

    expect(report.grid.rows[0]?.cells.every((cell) => cell.kind !== 'pending')).toBe(true)
  })

  it('stops an unsettled person the day before their newest entry', () => {
    // The next round can still carry more entries for that same day.
    const report = teamReportFrom(
      [page(hours(ANA, { entries: [entry('2026-05-12T09:00:00Z', 3600)], nextCursor: 'MQ' }))],
      options(),
    )
    const cells = report.grid.rows[0]?.cells ?? []

    expect(cells.find((cell) => cell.key === '2026-05-11')?.kind).toBe('unlogged')
    expect(cells.find((cell) => cell.key === '2026-05-12')?.kind).toBe('pending')
  })

  it('says nothing about any day for somebody who has nothing read yet', () => {
    const report = teamReportFrom([page(hours(ANA, { nextCursor: 'MQ' }))], options())

    expect(report.grid.rows[0]?.cells.every((cell) => cell.kind === 'pending')).toBe(true)
  })

  it('holds one person at pending while another is already final', () => {
    const report = teamReportFrom(
      [page(hours(ANA), hours(BRUNO, { nextCursor: 'MQ' }))],
      options({ members: [member(ANA), member(BRUNO)] }),
    )

    expect(report.grid.rows[0]?.cells.every((cell) => cell.kind !== 'pending')).toBe(true)
    expect(report.grid.rows[1]?.cells.every((cell) => cell.kind === 'pending')).toBe(true)
  })

  // GROUP-7: a finished row's total is final while the report is not.
  it('settles each row on its own read, not on the report’s', () => {
    const report = teamReportFrom(
      [page(hours(ANA), hours(BRUNO, { nextCursor: 'MQ' }))],
      options({ members: [member(ANA), member(BRUNO)] }),
    )

    expect(report.complete).toBe(false)
    expect(report.grid.rows.map((row) => row.settled)).toEqual([true, false])
  })
})
