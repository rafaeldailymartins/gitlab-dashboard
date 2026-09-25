import { describe, expect, it } from 'vitest'

import type { TeamsDocument } from './teams-document.mjs'

import {
  EMPTY_DOCUMENT,
  MAX_MEMBERS,
  MAX_NAME_LENGTH,
  MAX_TEAMS,
  parseDocument,
  readDocument,
} from './teams-document.mjs'

const MEMBER = { id: 'gid://gitlab/User/12345', name: 'Ada Lovelace', username: 'ada' }

function document(overrides: Partial<TeamsDocument> = {}): unknown {
  return { teams: [team()], version: 1, ...overrides }
}

function members(count: number) {
  return Array.from({ length: count }, (_member, index) => ({
    ...MEMBER,
    id: `gid://gitlab/User/${String(index)}`,
  }))
}

function team(overrides: Partial<TeamsDocument['teams'][number]> = {}) {
  return {
    id: '0193f2c1-8a7e-7f3a-9c21-3b5d6e7f8a90',
    members: [MEMBER],
    name: 'Squad Fiscal',
    updatedAt: '2026-09-18T14:30:00.000Z',
    ...overrides,
  }
}

describe('readDocument', () => {
  it('accepts a document this endpoint would have written', () => {
    const result = readDocument(document())

    expect(result.ok).toBe(true)
    expect(result.ok && result.document.teams[0]?.members[0]?.username).toBe('ada')
  })

  it('accepts a reader who has stored nothing', () => {
    expect(readDocument(EMPTY_DOCUMENT).ok).toBe(true)
  })

  it('refuses a version it does not know, rather than half-understanding it', () => {
    expect(readDocument(document({ version: 2 as 1 })).ok).toBe(false)
  })

  it.each([
    ['not an object', 'teams'],
    ['null', null],
    ['an array', []],
  ])('refuses a body that is %s', (_label, value) => {
    expect(readDocument(value).ok).toBe(false)
  })

  it('refuses a team identifier that is not a UUID', () => {
    // The identifier is what a shared team would later be addressed by, so its
    // shape is this endpoint's to decide rather than the client's.
    expect(readDocument(document({ teams: [team({ id: 'squad-fiscal' })] })).ok).toBe(false)
  })

  it('refuses a blank name and one past the ceiling', () => {
    expect(readDocument(document({ teams: [team({ name: ' '.repeat(3) })] })).ok).toBe(false)
    expect(
      readDocument(document({ teams: [team({ name: 'a'.repeat(MAX_NAME_LENGTH + 1) })] })).ok,
    ).toBe(false)
  })

  it('refuses a username that is not one', () => {
    const members = [{ ...MEMBER, username: 'ada lovelace' }]

    expect(readDocument(document({ teams: [team({ members })] })).ok).toBe(false)
  })

  it('refuses more teams than the ceiling', () => {
    const under = Array.from({ length: MAX_TEAMS }, (_one, index) => team({ id: uuid(index) }))

    expect(readDocument(document({ teams: under })).ok).toBe(true)
    expect(readDocument(document({ teams: [...under, team({ id: uuid(MAX_TEAMS) })] })).ok).toBe(
      false,
    )
  })

  it('refuses more members than the ceiling', () => {
    expect(readDocument(document({ teams: [team({ members: members(MAX_MEMBERS) })] })).ok).toBe(
      true,
    )
    expect(
      readDocument(document({ teams: [team({ members: members(MAX_MEMBERS + 1) })] })).ok,
    ).toBe(false)
  })

  it('refuses two teams sharing an identifier', () => {
    // Two rows for one team is a team whose edits race each other.
    expect(readDocument(document({ teams: [team(), team()] })).ok).toBe(false)
  })

  it('refuses one person listed twice on a team', () => {
    // A duplicate member would count their hours twice in every total.
    expect(readDocument(document({ teams: [team({ members: [MEMBER, MEMBER] })] })).ok).toBe(false)
  })

  it('refuses an instant that is not one', () => {
    expect(readDocument(document({ teams: [team({ updatedAt: 'yesterday' })] })).ok).toBe(false)
  })
})

describe('parseDocument', () => {
  it('reads the text a store or a request carried', () => {
    expect(parseDocument(JSON.stringify(document())).ok).toBe(true)
  })

  it('refuses text that is not JSON, rather than throwing at the caller', () => {
    // A stored value can be truncated by a write nobody finished, and a body is
    // whatever somebody posted. Neither is exceptional.
    expect(parseDocument('{"teams": [').ok).toBe(false)
    expect(parseDocument('').ok).toBe(false)
  })
})

function uuid(index: number): string {
  return `0193f2c1-8a7e-7f3a-9c21-${String(index).padStart(12, '0')}`
}
