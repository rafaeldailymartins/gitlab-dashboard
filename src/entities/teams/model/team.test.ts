import { describe, expect, it } from 'vitest'

import type { Team } from './team'

import {
  decodeTeams,
  encodeTeams,
  isValidTeamName,
  MAX_MEMBERS,
  MAX_NAME_LENGTH,
  MAX_TEAMS,
  orderedMembers,
  TEAMS_VERSION,
} from './team'

const ID = '0193f2c1-8a7e-7f3a-9c21-3b5d6e7f8a90'
const ADA = { id: 'gid://gitlab/User/1', name: 'Ada Lovelace', username: 'ada' }
const GRACE = { id: 'gid://gitlab/User/2', name: 'Grace Hopper', username: 'grace' }

function identifier(index: number): string {
  return `0193f2c1-8a7e-7f3a-9c21-${String(index).padStart(12, '0')}`
}

function stored(teams: readonly unknown[], version: unknown = TEAMS_VERSION): string {
  return JSON.stringify({ teams, version })
}

function team(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ID,
    members: [ADA],
    name: 'Squad Fiscal',
    updatedAt: '2026-09-18T14:30:00.000Z',
    ...overrides,
  }
}

describe('decodeTeams', () => {
  it('reads a document this app would have written', () => {
    const teams = decodeTeams(stored([team()]))

    expect(teams).toHaveLength(1)
    expect(teams[0]?.name).toBe('Squad Fiscal')
    expect(teams[0]?.members).toEqual([ADA])
  })

  it.each([
    ['nothing stored', null],
    ['the empty string', ''],
    ['text that is not JSON', '{oops'],
    ['JSON that is not an object', '42'],
    ['an object with no teams', '{}'],
    ['teams that are not a list', '{"teams":"none"}'],
  ])('yields no teams for %s', (_label, value) => {
    expect(decodeTeams(value)).toEqual([])
  })

  it('drops one unreadable team without costing the reader the others', () => {
    const teams = decodeTeams(stored(['not a team', team({ id: identifier(2) }), 7]))

    expect(teams).toHaveLength(1)
    expect(teams[0]?.id).toBe(identifier(2))
  })

  it('drops one unreadable member without costing the reader the team', () => {
    const teams = decodeTeams(stored([team({ members: [ADA, { id: 'x' }, 'nope', GRACE] })]))

    expect(teams[0]?.members).toEqual([ADA, GRACE])
  })

  it('drops a team whose identifier could never be saved', () => {
    // Keeping it would show a team whose first edit fails at the endpoint, with
    // no way back. A team that cannot be saved is not a team worth drawing.
    expect(decodeTeams(stored([team({ id: 'squad-fiscal' })]))).toEqual([])
  })

  it('drops a team with no usable name', () => {
    expect(decodeTeams(stored([team({ name: ' '.repeat(3) })]))).toEqual([])
    expect(decodeTeams(stored([team({ name: 'a'.repeat(MAX_NAME_LENGTH + 1) })]))).toEqual([])
  })

  it('reads a team whose members are not a list as a team with none', () => {
    expect(decodeTeams(stored([team({ members: 'nobody' })]))[0]?.members).toEqual([])
    expect(decodeTeams(stored([team({ members: undefined })]))[0]?.members).toEqual([])
  })

  it('trims a name rather than refusing it', () => {
    expect(decodeTeams(stored([team({ name: '  Squad Fiscal  ' })]))[0]?.name).toBe('Squad Fiscal')
  })

  it('repairs an unreadable instant instead of dropping the team', () => {
    // One bad date would otherwise make every future save of every team fail
    // the endpoint's check, which is a stuck state with no visible cause.
    const teams = decodeTeams(stored([team({ updatedAt: 'yesterday' })]))

    expect(teams).toHaveLength(1)
    expect(Number.isNaN(Date.parse(teams[0]?.updatedAt ?? ''))).toBe(false)
  })

  it('keeps the first of two members sharing an identifier', () => {
    const twin = { ...ADA, name: 'Ada again' }
    const teams = decodeTeams(stored([team({ members: [ADA, twin] })]))

    expect(teams[0]?.members).toEqual([ADA])
  })

  it('refuses a username that is not one', () => {
    const teams = decodeTeams(stored([team({ members: [{ ...ADA, username: 'ada lovelace' }] })]))

    expect(teams[0]?.members).toEqual([])
  })

  it('caps the teams and the members it will read', () => {
    const many = Array.from({ length: MAX_TEAMS + 5 }, (_one, index) =>
      team({ id: identifier(index) }),
    )
    const crowd = Array.from({ length: MAX_MEMBERS + 5 }, (_one, index) => ({
      ...ADA,
      id: `gid://gitlab/User/${String(index)}`,
    }))

    expect(decodeTeams(stored(many))).toHaveLength(MAX_TEAMS)
    expect(decodeTeams(stored([team({ members: crowd })]))[0]?.members).toHaveLength(MAX_MEMBERS)
  })
})

describe('encodeTeams', () => {
  it('writes the version the endpoint expects', () => {
    const written: unknown = JSON.parse(encodeTeams(decodeTeams(stored([team()]))))

    expect(written).toMatchObject({ version: TEAMS_VERSION })
  })

  it('round-trips what it wrote', () => {
    const teams = decodeTeams(stored([team()]))

    expect(decodeTeams(encodeTeams(teams))).toEqual(teams)
  })
})

describe('isValidTeamName', () => {
  it.each([
    ['a name', 'Squad Fiscal', true],
    ['a name that is only spaces', ' '.repeat(3), false],
    ['the empty string', '', false],
    ['a name at the ceiling', 'a'.repeat(MAX_NAME_LENGTH), true],
    ['a name past it', 'a'.repeat(MAX_NAME_LENGTH + 1), false],
  ])('%s', (_label, name, expected) => {
    expect(isValidTeamName(name)).toBe(expected)
  })
})

describe('orderedMembers', () => {
  it('orders by name, then by username for two who share one', () => {
    const twin = { id: 'gid://gitlab/User/3', name: 'Ada Lovelace', username: 'ada2' }
    const subject: Team = {
      id: ID,
      members: [GRACE, twin, ADA],
      name: 'Squad Fiscal',
      updatedAt: '2026-09-18T14:30:00.000Z',
    }

    expect(orderedMembers(subject).map((one) => one.username)).toEqual(['ada', 'ada2', 'grace'])
  })
})
