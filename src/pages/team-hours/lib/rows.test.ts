import { describe, expect, it } from 'vitest'
import { ANA, BRUNO, entry, member, SQUAD_FISCAL } from '~tests/support/gitlab-group-timelogs'

import type { GroupReport } from '@/entities/group-timelogs'

import { groupReportFrom, readerWindow, REFERENCE_SCHEDULE } from '@/entities/group-timelogs'
import { isoDate } from '@/shared/lib/date'

import { shownRows } from './rows'

const WINDOW = readerWindow(isoDate('2026-05-01'))
const HOUR = 3600

interface ReportOptions {
  readonly complete?: boolean
  /** Seconds the provider counts for Bruno beyond what it showed. */
  readonly hiddenFromBruno?: number
}

/** The names the screen would draw, in order. */
function drawn(report: GroupReport): string[] {
  return shownRows(report).map((row) => row.person.name)
}

function reportOf({ complete = true, hiddenFromBruno = 0 }: ReportOptions = {}): GroupReport {
  return groupReportFrom(
    [
      {
        entries: [entry(ANA, '2026-05-04T09:00:00Z', 6 * HOUR)],
        group: SQUAD_FISCAL,
        nextCursor: complete ? null : 'MQ',
      },
    ],
    {
      granularity: 'days',
      probe: {
        access: null,
        declared: { entryCount: 1, seconds: 6 * HOUR + hiddenFromBruno },
        group: SQUAD_FISCAL,
        perPerson:
          hiddenFromBruno === 0
            ? new Map()
            : new Map([[BRUNO.username, { entryCount: 1, seconds: hiddenFromBruno }]]),
      },
      reference: REFERENCE_SCHEDULE,
      roster: [member(ANA), member(BRUNO)],
      timeZone: 'UTC',
      today: isoDate('2026-06-15'),
      window: WINDOW,
    },
  )
}

describe('shownRows', () => {
  it('draws a row for whoever logged something', () => {
    expect(drawn(reportOf())).toContain(ANA.name)
  })

  it('leaves out a member who logged nothing here', () => {
    expect(drawn(reportOf())).not.toContain(BRUNO.name)
  })

  it('names nobody for having been left out', () => {
    // The screen sees one group. "Bruno logged nothing" is not a claim it can
    // support, and a line naming him would read as exactly that.
    expect(shownRows(reportOf())).toHaveLength(1)
  })

  it('keeps a row whose hours the provider counted and would not show', () => {
    // The row is what says which days the shortfall belongs to, and dropping it
    // would turn "hours you may not read" into "logged nothing".
    expect(drawn(reportOf({ hiddenFromBruno: 3 * HOUR }))).toContain(BRUNO.name)
  })

  it('leaves nobody out while the month is still being read', () => {
    expect(drawn(reportOf({ complete: false }))).toContain(BRUNO.name)
  })
})
