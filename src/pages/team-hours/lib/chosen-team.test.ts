import { describe, expect, it } from 'vitest'

import type { Team } from '@/entities/teams'

import { chosenTeam, teamOf } from './chosen-team'

const FISCAL: Team = {
  id: '018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d70',
  members: [],
  name: 'Squad Fiscal',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

const PLATFORM: Team = { ...FISCAL, id: '018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d71', name: 'Platform' }

describe('chosenTeam', () => {
  it('chooses the team the address names, wherever it sits in the list', () => {
    expect(chosenTeam([FISCAL, PLATFORM], PLATFORM.id)).toEqual({
      kind: 'chosen',
      team: PLATFORM,
    })
  })

  it('falls back to the first team when the address names none', () => {
    expect(chosenTeam([FISCAL, PLATFORM], '')).toEqual({ kind: 'chosen', team: FISCAL })
  })

  it('says the reader keeps none at all rather than reporting on nobody', () => {
    expect(chosenTeam([], '')).toEqual({ kind: 'none' })
  })

  it('says a named team is not theirs rather than showing them somebody else’s link', () => {
    // The fallback is deliberately not taken here: a link that named a team the
    // reader does not have would otherwise silently become a report on their own.
    expect(chosenTeam([FISCAL], PLATFORM.id)).toEqual({ kind: 'unknown' })
  })
})

describe('teamOf', () => {
  it('hands over the team a choice settled on', () => {
    expect(teamOf(chosenTeam([FISCAL], FISCAL.id))).toBe(FISCAL)
  })

  it('hands over nothing when the reader keeps no teams', () => {
    expect(teamOf(chosenTeam([], ''))).toBeNull()
  })

  it('hands over nothing when the address names a team that is not theirs', () => {
    expect(teamOf(chosenTeam([FISCAL], PLATFORM.id))).toBeNull()
  })
})
