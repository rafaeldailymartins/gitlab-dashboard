import type { SuggestionAnswer, SuggestionQuery } from '../model/ports'
import type { SuggestedMember } from '../model/types'

import { ask, PAGE_SIZE, type Reader } from './reader'
import { groupSuggestionsPayloadSchema, toSuggestedMember } from './schemas'
import { GROUP_SUGGESTIONS as SUGGESTIONS } from './suggestion-documents'

/**
 * How many pages of a group's entries are read before the read gives up.
 *
 * The answer wanted is a set of distinct *people*, and people saturate long
 * before entries do: a squad of ten logging twice a day fills about four hundred
 * entries a month, and the newest hundred of them already name everybody. Reading
 * further mostly buys the same names again — and buys them one round trip at a
 * time, because each page needs the last page's cursor, while somebody waits.
 *
 * Four rather than ten, cut with the window. Where the cap bites, the answer
 * carries `partial: true` and nothing on screen says so: a census that might be
 * short is a serious claim about a list that *is* the answer, and this list is a
 * team the reader is already looking at. What covers it is the search by name,
 * which reaches whoever the read missed, logged or not. See
 * `widgets/team-manager/lib/use-group-seeding.ts`.
 */
const MAX_PAGES = 4

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
