import type { SuggestionAnswer, SuggestionQuery } from '../model/ports'
import type { SuggestedMember } from '../model/types'

import { ask, PAGE_SIZE, type Reader } from './reader'
import { groupSuggestionsPayloadSchema, toSuggestedMember } from './schemas'
import { GROUP_SUGGESTIONS as SUGGESTIONS } from './suggestion-documents'

/**
 * How many pages of a group's entries are read before the list is called partial.
 *
 * The answer wanted is a set of distinct *people*, and people saturate long
 * before entries do: a busy group's window is thousands of timelogs and perhaps
 * forty names. Exhausting it would be hundreds of requests to learn forty of
 * them, so this stops and says so instead — and the individual search is the
 * escape hatch that always finds whoever the window missed.
 */
const MAX_PAGES = 10

/**
 * Whoever logged time in a group over the window.
 *
 * Read newest first, so a cap that bites drops the least recent contributors
 * rather than an arbitrary slice.
 */
export async function readSuggestions(
  reader: Reader,
  query: SuggestionQuery,
): Promise<SuggestionAnswer> {
  const people: SuggestedMember[] = []
  let after: null | string = null

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const read = await readPage(reader, query, after)

    people.push(...read.people)
    after = read.nextCursor

    if (after === null) {
      return { partial: false, people }
    }
  }

  return { partial: true, people }
}

async function readPage(
  reader: Reader,
  query: SuggestionQuery,
  after: null | string,
): Promise<{ nextCursor: null | string; people: readonly SuggestedMember[] }> {
  const answer = await ask(reader, SUGGESTIONS, {
    after,
    first: PAGE_SIZE,
    from: query.from,
    fullPath: query.fullPath,
    to: query.to,
  })
  const { group } = groupSuggestionsPayloadSchema.parse(answer.data)

  if (!group) {
    return { nextCursor: null, people: [] }
  }

  const { nodes, pageInfo } = group.timelogs

  return {
    nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
    people: nodes
      .filter((node) => node !== null)
      .map((node) => toSuggestedMember(node))
      .filter((person) => person !== null),
  }
}
