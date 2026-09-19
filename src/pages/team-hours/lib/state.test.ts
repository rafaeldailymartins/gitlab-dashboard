import { describe, expect, it, vi } from 'vitest'
import { ANA, member } from '~tests/support/gitlab-team-timelogs'

import type { Team } from '@/entities/teams'

import { REFERENCE_SCHEDULE, teamGrid } from '@/entities/team-timelogs'
import { isoDate } from '@/shared/lib/date'

import type { TeamChoice } from './chosen-team'
import type { SavedTeams } from './use-saved-teams'
import type { TeamHoursReport } from './use-team-report'

import { screenStateOf } from './state'

const MAY = { from: isoDate('2026-05-01'), to: isoDate('2026-05-31') }

const FISCAL: Team = {
  id: '018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d70',
  members: [member(ANA)],
  name: 'Squad Fiscal',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

const CHOSEN: TeamChoice = { kind: 'chosen', team: FISCAL }

/** A report whose first round has landed. Nothing here reads its figures. */
const READ: TeamHoursReport = {
  complete: true,
  declared: { entryCount: 0, seconds: 0 },
  empty: false,
  failure: null,
  grid: teamGrid({
    granularity: 'days',
    members: [],
    period: MAY,
    reference: REFERENCE_SCHEDULE,
    timeZone: 'UTC',
    today: MAY.to,
  }),
  month: MAY.from,
  scope: null,
  shortfall: null,
  sync: vi.fn(),
  syncedAt: null,
  syncing: false,
  today: MAY.to,
  visible: { entryCount: 0, hours: 0, seconds: 0 },
}

interface Scenario {
  readonly choice?: TeamChoice
  readonly report?: TeamHoursReport
  readonly saved?: Partial<SavedTeams>
}

/** The screen as it stands, from a store that answered and a report that arrived. */
function kindOf({ choice = CHOSEN, report = READ, saved = {} }: Scenario = {}): string {
  return screenStateOf({
    choice,
    report,
    saved: { failure: null, loading: false, teams: [FISCAL], ...saved },
  }).kind
}

describe('while the store has not answered', () => {
  it('waits, rather than saying anything about teams it has not read', () => {
    expect(kindOf({ saved: { loading: true } })).toBe('loading')
  })

  it('waits even where the choice already looks empty', () => {
    // The store is asked about first on purpose: "you have no teams yet" while
    // the read is in flight invites somebody to build one they already have.
    expect(kindOf({ choice: { kind: 'none' }, saved: { loading: true } })).toBe('loading')
  })
})

describe('when the store would not answer', () => {
  it('asks for the session to be authorised again when it carries no identity', () => {
    expect(kindOf({ saved: { failure: { kind: 'identity-unavailable' } } })).toBe('reconnect')
  })

  it('says the store is unavailable for anything else, which is what a reader can act on', () => {
    expect(kindOf({ saved: { failure: { kind: 'rejected' } } })).toBe('teams-unavailable')
  })
})

describe('when the address and the teams disagree', () => {
  it('says the reader keeps no teams yet', () => {
    expect(kindOf({ choice: { kind: 'none' }, saved: { teams: [] } })).toBe('no-teams')
  })

  it('says the named team is not one of theirs', () => {
    expect(kindOf({ choice: { kind: 'unknown' } })).toBe('unknown-team')
  })
})

describe('once a team is chosen', () => {
  it('says nobody is on it, which is not the same as nobody logging', () => {
    const empty: TeamChoice = { kind: 'chosen', team: { ...FISCAL, members: [] } }

    expect(kindOf({ choice: empty })).toBe('empty-team')
  })

  it('waits while the first round is still on its way', () => {
    expect(kindOf({ report: { ...READ, empty: true } })).toBe('loading')
  })

  it('shows the report once anything at all has arrived', () => {
    expect(kindOf()).toBe('report')
  })
})
