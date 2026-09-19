import { describe, expect, it } from 'vitest'

import { decodeTeams, encodeTeams } from '../../src/entities/teams/model/team'
import { MAX_MEMBERS, MAX_TEAMS, parseDocument } from './teams-document.mjs'

/**
 * The two readers of one stored shape, held against each other.
 *
 * The browser's decoder is deliberately lenient and the endpoint's validator is
 * deliberately strict: one is recovering from something already stored, the
 * other is deciding what may be stored at all. They answer different questions,
 * so they may disagree — but only in ONE direction.
 *
 * Everything the browser will write, the endpoint must accept. The other way
 * round is a stuck reader: the screen shows a team, the reader edits it, and the
 * save is refused for a reason nothing on screen can explain, with no way back
 * because every later save carries the whole document.
 *
 * `src/entities/teams/model/team.ts` states this as its intent — "a deliberate
 * pair", "a subset of what the endpoint accepts". This is the test that keeps it
 * true, because the two files are in different layers, different runtimes and
 * different Vitest projects, and nothing else makes them meet.
 */

const ANA = { id: 'gid://gitlab/User/2318742', name: 'Ana Souza', username: 'ana.souza' }
const BRUNO = { id: 'gid://gitlab/User/2318743', name: 'Bruno Lima', username: 'bruno.lima' }

const IDENTIFIER = '018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d70'
const OTHER_IDENTIFIER = '018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d71'

/** One table of stored documents, run through both halves. */
const STORED: readonly { name: string; text: string }[] = [
  { name: 'nothing stored yet', text: JSON.stringify({ teams: [], version: 1 }) },
  {
    name: 'one team with two people',
    text: JSON.stringify({
      teams: [
        {
          id: IDENTIFIER,
          members: [ANA, BRUNO],
          name: 'Squad Fiscal',
          updatedAt: '2026-05-01T00:00:00.000Z',
        },
      ],
      version: 1,
    }),
  },
  {
    name: 'two teams sharing a member',
    text: JSON.stringify({
      teams: [
        { id: IDENTIFIER, members: [ANA], name: 'Fiscal', updatedAt: '2026-05-01T00:00:00.000Z' },
        {
          id: OTHER_IDENTIFIER,
          members: [ANA, BRUNO],
          name: 'Platform',
          updatedAt: '2026-05-02T00:00:00.000Z',
        },
      ],
      version: 1,
    }),
  },
  {
    name: 'a team with nobody on it',
    text: JSON.stringify({
      teams: [
        { id: IDENTIFIER, members: [], name: 'New team', updatedAt: '2026-05-01T00:00:00.000Z' },
      ],
      version: 1,
    }),
  },
  {
    name: 'a name with whitespace around it',
    text: JSON.stringify({
      teams: [
        {
          id: IDENTIFIER,
          members: [ANA],
          name: '  Fiscal  ',
          updatedAt: '2026-05-01T00:00:00.000Z',
        },
      ],
      version: 1,
    }),
  },
  { name: 'the ceilings, exactly', text: encodeTeams(fullDocument()) },
]

/** A document at both ceilings at once, which is what the store must still take. */
function fullDocument() {
  return Array.from({ length: MAX_TEAMS }, (_team, teamIndex) => ({
    id: identifierFor(teamIndex),
    members: Array.from({ length: MAX_MEMBERS }, (_member, index) => ({
      id: `gid://gitlab/User/${String(index)}`,
      name: `Person ${String(index)}`,
      username: `person.${String(index)}`,
    })),
    name: `Team ${String(teamIndex)}`,
    updatedAt: '2026-05-01T00:00:00.000Z',
  }))
}

/** A v4-shaped identifier per index, since the strict half checks the shape. */
function identifierFor(index: number): string {
  return `018f3b2c-7a41-7c9e-9f2d-${String(index).padStart(12, '0')}`
}

describe('the lenient reader and the strict one', () => {
  it.each(STORED)('both read $name, and neither drops what the other kept', ({ text }) => {
    const lenient = decodeTeams(text)
    const strict = parseDocument(text)

    expect(strict.ok).toBe(true)
    expect(strict.ok ? strict.document.teams.length : -1).toBe(lenient.length)
  })

  it.each(STORED)('what the browser would write back for $name is accepted', ({ text }) => {
    // The round trip is the real contract: the browser reads, the reader edits,
    // and the browser writes the WHOLE document back. Anything its encoder emits
    // that the endpoint refuses is a reader who cannot save again.
    expect(parseDocument(encodeTeams(decodeTeams(text))).ok).toBe(true)
  })
})

describe('what the browser recovers from, and the endpoint refuses', () => {
  const DAMAGED = JSON.stringify({
    teams: [
      { id: 'not-a-uuid', members: [ANA], name: 'Gone', updatedAt: '2026-05-01T00:00:00.000Z' },
      {
        id: IDENTIFIER,
        members: [ANA, { id: '', name: '', username: '' }],
        name: 'Fiscal',
        updatedAt: 'not an instant',
      },
    ],
    version: 1,
  })

  it('refuses the damaged document on the way in', () => {
    // The two answer different questions, and this is the direction they are
    // allowed to differ in: the endpoint decides what may be stored, and this
    // was never written by anything it accepted.
    expect(parseDocument(DAMAGED).ok).toBe(false)
  })

  it('recovers it at the smallest scope that makes sense', () => {
    const recovered = decodeTeams(DAMAGED)

    // The team with an unusable identifier is gone; the one with a damaged
    // member keeps the member it could read, and the unreadable date is repaired
    // rather than taking the team with it.
    expect(recovered).toHaveLength(1)
    expect(recovered[0]?.members).toHaveLength(1)
  })

  it('writes back something the endpoint will now accept', () => {
    // This is the whole point of repairing rather than dropping. A reader whose
    // stored document is damaged must be able to save their next edit; if the
    // recovery emitted something still refused, they would be stuck with no way
    // to see why.
    expect(parseDocument(encodeTeams(decodeTeams(DAMAGED))).ok).toBe(true)
  })
})
