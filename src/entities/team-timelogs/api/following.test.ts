import { describe, expect, it, vi } from 'vitest'
import {
  ANA,
  BRUNO,
  followingPayload,
  SQUAD_FISCAL,
  timelogNode,
} from '~tests/support/gitlab-team-timelogs'

import type { GraphQLClient } from '@/shared/api'

import type { TeamFollowingQuery } from '../model/ports'

import { readFollowing } from './following'

const HOUR = 3600

const CURSORS = [
  { cursor: 'eyJpZCI6IjEzNzA5OTg0In0', memberId: ANA.id },
  { cursor: 'eyJpZCI6IjEzNzA5OTg1In0', memberId: BRUNO.id },
]

const QUERY: TeamFollowingQuery = {
  cursors: CURSORS,
  from: '2026-05-01T03:00:00.000Z',
  groupId: null,
  to: '2026-06-01T02:59:59.999999Z',
}

interface Asked {
  query: string
  variables: Record<string, unknown>
}

/** How many people one document addresses, counted the way the provider bills it. */
function aliasCount(query: string): number {
  return query.match(/user\(id: \$u\d+\)/g)?.length ?? 0
}

/** A provider that answers with exactly as many people as it was asked about. */
function echoing(asked: Asked): unknown {
  const people = Object.keys(asked.variables).filter((name) => /^u\d+$/.test(name))

  return followingPayload(people.map(() => ({ person: ANA })))
}

function fakeReader(respond: (asked: Asked) => unknown) {
  const sent: Asked[] = []
  const request = vi.fn((asked: Parameters<GraphQLClient['request']>[0]) => {
    const one = { query: asked.query, variables: asked.variables }

    sent.push(one)

    return Promise.resolve({ data: respond(one), errors: [] })
  })
  const client = { request } satisfies GraphQLClient

  return { client, reader: { client, signal: undefined }, sent }
}

function someCursors(count: number): TeamFollowingQuery['cursors'] {
  return Array.from({ length: count }, (_one, index) => ({
    cursor: `after-${String(index)}`,
    memberId: `gid://gitlab/User/${String(2_318_742 + index)}`,
  }))
}

describe('readFollowing', () => {
  it('asks nothing when nobody is still unread', async () => {
    const { client, reader } = fakeReader(echoing)

    expect(await readFollowing(reader, { ...QUERY, cursors: [] })).toEqual({ members: [] })
    expect(client.request).not.toHaveBeenCalled()
  })

  it('splits seventeen people into two requests of at most sixteen', async () => {
    // Measured against the real provider: one alias scores 17 of the 250-point
    // budget and sixteen score 227, while twenty-four score 339 and are refused.
    const { reader, sent } = fakeReader(echoing)

    const read = await readFollowing(reader, { ...QUERY, cursors: someCursors(17) })

    expect(sent.map((one) => aliasCount(one.query))).toEqual([16, 1])
    expect(read.members).toHaveLength(17)
  })

  it('asks about sixteen people in one request', async () => {
    const { reader, sent } = fakeReader(echoing)

    await readFollowing(reader, { ...QUERY, cursors: someCursors(16) })

    expect(sent).toHaveLength(1)
  })

  it('sends identifiers and cursors as variables, never inside the document', async () => {
    // A document assembled around provider data is a document that data can
    // rewrite — and a global id is not a valid GraphQL name to begin with.
    const { reader, sent } = fakeReader(echoing)

    await readFollowing(reader, QUERY)

    expect(sent[0]?.variables).toMatchObject({
      c0: CURSORS[0]?.cursor,
      c1: CURSORS[1]?.cursor,
      u0: ANA.id,
      u1: BRUNO.id,
    })
    expect(sent[0]?.query).not.toContain(ANA.id)
    expect(sent[0]?.query).not.toContain(CURSORS[0]?.cursor ?? 'never')
  })

  it('narrows every alias to the same window and group as the figures', async () => {
    const { reader, sent } = fakeReader(echoing)

    await readFollowing(reader, { ...QUERY, groupId: SQUAD_FISCAL.id })

    expect(sent[0]?.variables).toMatchObject({
      from: QUERY.from,
      group: SQUAD_FISCAL.id,
      to: QUERY.to,
    })
  })

  it('reads each alias back by its position, not by the order it arrived in', async () => {
    // The aliases are handed back reversed: a reader taking the payload's own
    // key order would pair every person with somebody else's hours.
    const { reader } = fakeReader(() =>
      Object.fromEntries(
        Object.entries(
          followingPayload([
            { nodes: [timelogNode({ timeSpent: 2 * HOUR })], person: ANA },
            { nodes: [timelogNode({ timeSpent: 3 * HOUR })], person: BRUNO },
          ]),
        ).toReversed(),
      ),
    )

    const read = await readFollowing(reader, QUERY)

    expect(read.members.map((one) => one.person)).toEqual([ANA, BRUNO])
    expect(read.members.map((one) => one.entries[0]?.seconds)).toEqual([2 * HOUR, 3 * HOUR])
  })

  it('drops an alias the provider answered null', async () => {
    // Rather than letting it become a person with no hours: a row of zeroes
    // beside a real name is a claim about them that null does not support.
    const { reader } = fakeReader(() => ({
      ...followingPayload([{ person: ANA }, { person: BRUNO }]),
      a0: null,
    }))

    const read = await readFollowing(reader, QUERY)

    expect(read.members.map((one) => one.person)).toEqual([BRUNO])
  })

  it('carries no aggregates on a continuation', async () => {
    // They are window-wide, so asking again returns the same number at a later
    // instant — which can disagree with the page it is compared against for
    // reasons that are not redaction.
    const { reader, sent } = fakeReader(echoing)

    const read = await readFollowing(reader, QUERY)

    expect(read.members.map((one) => one.declared)).toEqual([null, null])
    expect(sent[0]?.query).not.toContain('count')
    expect(sent[0]?.query).not.toContain('totalSpentTime')
  })

  it('reads whether there is more from hasNextPage alone', async () => {
    // The provider computes it before removing what the reader may not read, so
    // a round can carry no entries and still have more after it; stopping on an
    // empty one would abandon the rest of that person's window.
    const { reader } = fakeReader(() =>
      followingPayload([
        { cursor: 'after-the-empty-round', more: true, nodes: [], person: ANA },
        { cursor: 'a-cursor-nothing-follows', more: false, person: BRUNO },
      ]),
    )

    const read = await readFollowing(reader, QUERY)

    expect(read.members.map((one) => one.nextCursor)).toEqual(['after-the-empty-round', null])
  })
})
