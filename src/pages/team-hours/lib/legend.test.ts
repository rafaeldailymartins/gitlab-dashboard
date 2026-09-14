import { describe, expect, it } from 'vitest'
import { ANA, entry, member } from '~tests/support/gitlab-group-timelogs'

import type { GridRequest, TeamGrid } from '@/entities/group-timelogs'

import { REFERENCE_SCHEDULE, teamGrid } from '@/entities/group-timelogs'
import { isoDate } from '@/shared/lib/date'

import { legendShows } from './legend'

const MAY = { from: isoDate('2026-05-01'), to: isoDate('2026-05-31') }
const HOUR = 3600

function gridOf(overrides: Partial<GridRequest> = {}): TeamGrid {
  const request: GridRequest = {
    entries: [],
    granularity: 'days',
    loadedThrough: MAY.to,
    period: MAY,
    perPerson: new Map(),
    reference: REFERENCE_SCHEDULE,
    roster: [member(ANA)],
    timeZone: 'UTC',
    today: isoDate('2026-06-15'),
    ...overrides,
  }

  return teamGrid(request)
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
    const over = gridOf({ entries: [entry(ANA, '2026-05-12T09:00:00Z', 10 * HOUR)] })

    expect(legendShows(over).over).toBe(true)
  })

  it('lists nothing at all for a table with no rows', () => {
    const empty = gridOf({ roster: [] })

    expect(legendShows(empty)).toEqual({ nonWorking: false, over: false, unlogged: false })
  })
})
