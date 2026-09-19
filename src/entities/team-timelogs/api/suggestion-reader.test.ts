import { describe, expect, it, vi } from 'vitest'
import {
  ANA,
  BRUNO,
  CAMILA,
  SQUAD_FISCAL,
  suggestedMember,
  suggestionNode,
  suggestionsPayload,
} from '~tests/support/gitlab-team-timelogs'

import type { GraphQLClient } from '@/shared/api'

import type { SuggestionQuery } from '../model/ports'
import type { Person } from '../model/types'

import { readSuggestions } from './suggestion-reader'

const QUERY: SuggestionQuery = {
  from: '2026-05-01T03:00:00.000Z',
  fullPath: SQUAD_FISCAL.fullPath,
  to: '2026-06-01T02:59:59.999999Z',
}

interface Asked {
  query: string
  variables: Record<string, unknown>
}

/**
 * A provider that answers the given pages in order.
 *
 * The last one answers every request after it, which is how a test hands the
 * cap a window that never runs out.
 */
function fakeReader(pages: readonly unknown[]) {
  const sent: Asked[] = []
  const request = vi.fn((asked: Parameters<GraphQLClient['request']>[0]) => {
    sent.push({ query: asked.query, variables: asked.variables })

    return Promise.resolve({
      data: pages[Math.min(sent.length - 1, pages.length - 1)],
      errors: [],
    })
  })
  const client = { request } satisfies GraphQLClient

  return { client, reader: { client, signal: undefined }, sent }
}

/** A page that says there is another after it. */
function page(person: Person, cursor: string) {
  return suggestionsPayload({
    endCursor: cursor,
    hasNextPage: true,
    nodes: [suggestionNode(person)],
  })
}

describe('readSuggestions', () => {
  it('reads on until the provider runs out, keeping everybody it saw', async () => {
    const { reader } = fakeReader([
      page(ANA, 'second-page'),
      page(BRUNO, 'third-page'),
      suggestionsPayload({ nodes: [suggestionNode(CAMILA)] }),
    ])

    const read = await readSuggestions(reader, QUERY)

    expect(read.people.map((one) => one.person)).toEqual([ANA, BRUNO, CAMILA])
    expect(read.partial).toBe(false)
  })

  it('carries each page’s cursor into the request that continues it', async () => {
    const { reader, sent } = fakeReader([
      page(ANA, 'second-page'),
      suggestionsPayload({ nodes: [suggestionNode(BRUNO)] }),
    ])

    await readSuggestions(reader, QUERY)

    expect(sent.map((one) => one.variables['after'])).toEqual([null, 'second-page'])
    expect(sent[0]?.variables).toMatchObject({
      from: QUERY.from,
      fullPath: SQUAD_FISCAL.fullPath,
      to: QUERY.to,
    })
  })

  it('stops at ten pages and says the list is partial', async () => {
    // The answer wanted is a set of people, and people saturate long before
    // entries do: exhausting a busy group would be hundreds of requests to
    // learn forty names. Repeats are expected — `model/suggestions.ts` is where
    // the same person seen on six pages becomes one candidate.
    const { reader, sent } = fakeReader([page(ANA, 'and-another-after-this')])

    const read = await readSuggestions(reader, QUERY)

    expect(sent).toHaveLength(10)
    expect(read.partial).toBe(true)
    expect(read.people).toHaveLength(10)
  })

  it('reads newest first, so a cap that bites drops the least recent', async () => {
    const { reader, sent } = fakeReader([suggestionsPayload()])

    await readSuggestions(reader, QUERY)

    expect(sent[0]?.query).toContain('sort: SPENT_AT_DESC')
  })

  it('answers nothing for a group it cannot read, rather than throwing', async () => {
    // `group: null` is how the provider says this reader may not open it. The
    // picker offers nobody; the individual search still finds whoever they want.
    const { reader, sent } = fakeReader([suggestionsPayload({ group: null })])

    expect(await readSuggestions(reader, QUERY)).toEqual({ partial: false, people: [] })
    expect(sent).toHaveLength(1)
  })

  it('drops a node whose user the provider would not resolve', async () => {
    // A suggestion with no name is worse than no suggestion: there is nothing
    // to put on a team and nothing to recognise.
    const { reader } = fakeReader([
      suggestionsPayload({ nodes: [suggestionNode(ANA), { user: null }] }),
    ])

    const read = await readSuggestions(reader, QUERY)

    expect(read.people.map((one) => one.person)).toEqual([ANA])
  })

  it('offers a bot and a deactivated account, flagged rather than hidden', async () => {
    // Both logged time in the window, so both are answers to what the reader
    // asked. What to do about them is the picker's decision, not this one's.
    const { reader } = fakeReader([
      suggestionsPayload({
        nodes: [
          suggestionNode(ANA, { bot: true }),
          suggestionNode(BRUNO, { state: 'deactivated' }),
        ],
      }),
    ])

    const read = await readSuggestions(reader, QUERY)

    expect(read.people).toEqual([
      suggestedMember(ANA, { bot: true }),
      suggestedMember(BRUNO, { active: false }),
    ])
  })
})
