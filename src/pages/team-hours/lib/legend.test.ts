import { describe, expect, it } from 'vitest'
import { ANA, entry, member } from '~tests/support/gitlab-team-timelogs'

import type { GridRequest, TeamGrid } from '@/entities/team-timelogs'

import { REFERENCE_SCHEDULE, teamGrid } from '@/entities/team-timelogs'
import { isoDate } from '@/shared/lib/date'

import { legendShows } from './legend'

const MAY = { from: isoDate('2026-05-01'), to: isoDate('2026-05-31') }
const HOUR = 3600

function gridOf(overrides: Partial<GridRequest> = {}): TeamGrid {
  return teamGrid({
    granularity: 'days',
    members: [
      {
        declared: null,
        entries: [],
        identity: { kind: 'confirmed', person: ANA },
        loadedThrough: MAY.to,
        member: member(ANA),
      },
    ],
    period: MAY,
    reference: REFERENCE_SCHEDULE,
    timeZone: 'UTC',
    today: isoDate('2026-06-15'),
    ...overrides,
  })
}

describe('legendShows', () => {
  it('lists the unlogged mark when a working day is empty', () => {
    expect(legendShows(gridOf()).unlogged).toBe(true)
  })

  it('lists the weekend tint, because a month always has one', () => {
    expect(legendShows(gridOf()).nonWorking).toBe(true)
  })

  it('does not list a day above the reference until there is one', () => {
    expect(legendShows(gridOf()).over).toBe(false)
  })

  it('lists it once somebody has gone past the reference', () => {
    const over = gridOf({
      members: [
        {
          declared: null,
          entries: [entry('2026-05-12T09:00:00Z', 10 * HOUR)],
          identity: { kind: 'confirmed', person: ANA },
          loadedThrough: MAY.to,
          member: member(ANA),
        },
      ],
    })

    expect(legendShows(over).over).toBe(true)
  })

  it('lists nothing at all for a table with no rows', () => {
    const empty = gridOf({ members: [] })

    expect(legendShows(empty)).toEqual({ nonWorking: false, over: false, unlogged: false })
  })
})
