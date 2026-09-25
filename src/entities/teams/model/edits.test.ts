import { describe, expect, it } from 'vitest'

import type { Team } from './team'

import {
  newTeam,
  withMember,
  withMembers,
  withName,
  withoutMember,
  withoutTeam,
  withTeam,
  withUpdated,
} from './edits'
import { MAX_MEMBERS, MAX_NAME_LENGTH, MAX_TEAMS } from './team'

const ID = '0193f2c1-8a7e-7f3a-9c21-3b5d6e7f8a90'
const OTHER = '0193f2c1-8a7e-7f3a-9c21-3b5d6e7f8a91'
const MADE_AT = '2026-09-18T14:30:00.000Z'
const LATER = '2026-09-19T09:00:00.000Z'

const ADA = { id: 'gid://gitlab/User/1', name: 'Ada Lovelace', username: 'ada' }
const GRACE = { id: 'gid://gitlab/User/2', name: 'Grace Hopper', username: 'grace' }

function squad(): Team {
  return withMember(newTeam(ID, 'Squad Fiscal', MADE_AT), ADA, MADE_AT)
}

describe('newTeam', () => {
  it('starts with nobody on it', () => {
    const team = newTeam(ID, 'Squad Fiscal', MADE_AT)

    expect(team).toEqual({ id: ID, members: [], name: 'Squad Fiscal', updatedAt: MADE_AT })
  })

  it('trims the name it was given', () => {
    expect(newTeam(ID, '  Squad Fiscal  ', MADE_AT).name).toBe('Squad Fiscal')
  })
})

describe('withMember', () => {
  it('adds somebody and dates the change', () => {
    const team = withMember(squad(), GRACE, LATER)

    expect(team.members).toEqual([ADA, GRACE])
    expect(team.updatedAt).toBe(LATER)
  })

  it('leaves the team alone when they are already on it', () => {
    const before = squad()
    const after = withMember(before, { ...ADA, name: 'Ada again' }, LATER)

    // A duplicate would count their hours twice in every total.
    expect(after).toBe(before)
  })

  it('refuses to grow past the ceiling', () => {
    let crowd = newTeam(ID, 'Big', MADE_AT)

    for (let index = 0; index < MAX_MEMBERS; index += 1) {
      crowd = withMember(crowd, { ...ADA, id: `gid://gitlab/User/${String(index)}` }, MADE_AT)
    }

    expect(crowd.members).toHaveLength(MAX_MEMBERS)
    expect(withMember(crowd, GRACE, LATER)).toBe(crowd)
  })

  it('does not mutate the team it was given', () => {
    const before = squad()

    withMember(before, GRACE, LATER)

    expect(before.members).toEqual([ADA])
  })
})

describe('withoutMember', () => {
  it('takes somebody off and dates the change', () => {
    const team = withoutMember(withMember(squad(), GRACE, MADE_AT), ADA.id, LATER)

    expect(team.members).toEqual([GRACE])
    expect(team.updatedAt).toBe(LATER)
  })

  it('leaves the team alone when they were never on it', () => {
    const before = squad()

    expect(withoutMember(before, GRACE.id, LATER)).toBe(before)
  })

  it('can empty a team', () => {
    expect(withoutMember(squad(), ADA.id, LATER).members).toEqual([])
  })
})

describe('withMembers', () => {
  const LINUS = { id: 'gid://gitlab/User/3', name: 'Linus Torvalds', username: 'linus' }

  it('adds everybody who is not already there, in one dated change', () => {
    const team = withMembers(squad(), [GRACE, LINUS], LATER)

    expect(team.members).toEqual([ADA, GRACE, LINUS])
    expect(team.updatedAt).toBe(LATER)
  })

  it('keeps the ones already on the team rather than adding them twice', () => {
    const team = withMembers(squad(), [{ ...ADA, name: 'Ada again' }, GRACE], LATER)

    expect(team.members).toEqual([ADA, GRACE])
  })

  it('adds somebody named twice in the same batch once', () => {
    const team = withMembers(squad(), [GRACE, { ...GRACE, name: 'Grace again' }], LATER)

    expect(team.members).toEqual([ADA, GRACE])
  })

  // A version moved with no member moved is a conflict made out of nothing.
  it('leaves the team alone, instant included, when nobody is new', () => {
    const before = squad()

    expect(withMembers(before, [ADA], LATER)).toBe(before)
    expect(withMembers(before, [], LATER)).toBe(before)
  })

  // A usable team beats no team: the rest are still reachable by name.
  it('fills up to the ceiling rather than refusing the whole batch', () => {
    const crowd = Array.from({ length: MAX_MEMBERS + 5 }, (_, index) => ({
      ...GRACE,
      id: `gid://gitlab/User/crowd-${String(index)}`,
    }))
    const team = withMembers(squad(), crowd, LATER)

    expect(team.members).toHaveLength(MAX_MEMBERS)
    expect(team.members[0]).toBe(ADA)
  })
})

describe('withName', () => {
  it('renames and dates the change', () => {
    const team = withName(squad(), '  Squad Doc  ', LATER)

    expect(team.name).toBe('Squad Doc')
    expect(team.updatedAt).toBe(LATER)
  })

  it('keeps the identifier, so an address to it still means the same team', () => {
    expect(withName(squad(), 'Squad Doc', LATER).id).toBe(ID)
  })

  it.each([
    ['a blank name', ' '.repeat(3)],
    ['a name past the ceiling', 'a'.repeat(MAX_NAME_LENGTH + 1)],
  ])('refuses %s rather than storing it', (_label, name) => {
    const before = squad()

    expect(withName(before, name, LATER)).toBe(before)
  })
})

describe('the reader’s list of teams', () => {
  it('adds one', () => {
    expect(withTeam([squad()], newTeam(OTHER, 'Squad Doc', LATER))).toHaveLength(2)
  })

  it('refuses a second team under one identifier', () => {
    const teams = [squad()]

    expect(withTeam(teams, newTeam(ID, 'Squad Doc', LATER))).toBe(teams)
  })

  it('refuses to grow past the ceiling', () => {
    const many = Array.from({ length: MAX_TEAMS }, (_one, index) =>
      newTeam(`0193f2c1-8a7e-7f3a-9c21-${String(index).padStart(12, '0')}`, 'Squad', MADE_AT),
    )

    expect(withTeam(many, newTeam(OTHER, 'One more', LATER))).toBe(many)
  })

  it('replaces one, matched on its identifier', () => {
    const renamed = withName(squad(), 'Squad Doc', LATER)

    expect(withUpdated([squad()], renamed)[0]?.name).toBe('Squad Doc')
  })

  it('leaves the list alone when the replacement matches nothing', () => {
    const teams = [squad()]

    expect(withUpdated(teams, newTeam(OTHER, 'Stranger', LATER))).toEqual(teams)
  })

  it('deletes one', () => {
    expect(withoutTeam([squad()], ID)).toEqual([])
    expect(withoutTeam([squad()], OTHER)).toHaveLength(1)
  })
})
