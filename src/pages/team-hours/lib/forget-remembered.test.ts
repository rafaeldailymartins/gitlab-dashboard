import { describe, expect, it } from 'vitest'

import type { Team } from '@/entities/teams'

import type { SavedTeams } from './use-saved-teams'

import { forgetsRemembered } from './forget-remembered'

function team(id: string): Team {
  return { id, members: [], name: `Team ${id}`, updatedAt: '2026-05-01T00:00:00.000Z' }
}

const A = team('018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d70')
const B = team('018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d71')

function answered(...teams: Team[]): SavedTeams {
  return { failure: null, loading: false, teams }
}

describe('forgetsRemembered', () => {
  // The reported bug: A was deleted from Settings or another device, the route
  // redirected the bare address into it, and every visit said it was not theirs.
  it('forgets a remembered team the list no longer holds', () => {
    expect(forgetsRemembered(answered(B), A.id, A.id)).toBe(true)
  })

  it('forgets it when no teams are left at all', () => {
    expect(forgetsRemembered(answered(), A.id, A.id)).toBe(true)
  })

  it('keeps a remembered team that is still there', () => {
    expect(forgetsRemembered(answered(A, B), A.id, A.id)).toBe(false)
  })

  // GROUP-14: an address somebody sent still says the team is not the reader's.
  it('leaves a sent link to a team the reader never remembered', () => {
    expect(forgetsRemembered(answered(B), A.id, '')).toBe(false)
    expect(forgetsRemembered(answered(B), A.id, B.id)).toBe(false)
  })

  it('leaves an address that names no team', () => {
    expect(forgetsRemembered(answered(B), '', '')).toBe(false)
  })

  // An empty list while loading, or after a refusal, is not a list without A.
  it('waits while the list is still being read', () => {
    expect(forgetsRemembered({ failure: null, loading: true, teams: [] }, A.id, A.id)).toBe(false)
  })

  it('forgets nothing when the store could not be read', () => {
    const refused: SavedTeams = { failure: { kind: 'unavailable' }, loading: false, teams: [] }

    expect(forgetsRemembered(refused, A.id, A.id)).toBe(false)
  })
})
