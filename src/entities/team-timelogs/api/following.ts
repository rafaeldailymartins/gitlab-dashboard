import type { MemberHours, TeamFollowingQuery, TeamHoursPage } from '../model/ports'

import { followAlias, followCursor, followUser, teamHoursFollowing } from './documents'
import { ask, PAGE_SIZE, type Reader } from './reader'
import {
  followedMemberSchema,
  teamFollowingPayloadSchema,
  toPerson,
  toTimelogEntry,
} from './schemas'

/**
 * How many people one continuation asks about.
 *
 * Measured against the real provider: one alias scores 17 of the 250-point
 * budget, eight score 115 and sixteen score 227 — 14 a head. Twenty-four score
 * 339 and are refused. Seventeen would fit at 241, which is not enough room to
 * absorb a field somebody adds later.
 */
const FOLLOW_BATCH = 16

/**
 * The rest of the window, for whoever's first round did not hold it.
 *
 * This file exists beside the gateway rather than inside it for the reason
 * `column-probe.ts` does: a reader that builds its own aliased variables is
 * enough code to push the gateway past its line ceiling, and it reads better on
 * its own anyway.
 *
 * It is not a path kept for a hypothetical. On the squad this was measured
 * against, one person logged 132 entries in a month — past the hundred-entry
 * page, so the real data already needs it.
 */
export async function readFollowing(
  reader: Reader,
  query: TeamFollowingQuery,
): Promise<TeamHoursPage> {
  const members: MemberHours[] = []

  for (const batch of batched(query.cursors)) {
    members.push(...(await readBatch(reader, query, batch)))
  }

  return { members }
}

function aliasVariables(cursors: TeamFollowingQuery['cursors']): Record<string, unknown> {
  return Object.fromEntries(
    cursors.flatMap((one, index) => [
      [followUser(index), one.memberId],
      [followCursor(index), one.cursor],
    ]),
  )
}

function batched(cursors: TeamFollowingQuery['cursors']): readonly TeamFollowingQuery['cursors'][] {
  if (cursors.length === 0) {
    return []
  }

  return Array.from({ length: Math.ceil(cursors.length / FOLLOW_BATCH) }, (_unused, index) =>
    cursors.slice(index * FOLLOW_BATCH, (index + 1) * FOLLOW_BATCH),
  )
}

/**
 * One alias's answer.
 *
 * No aggregates: they were read on the first round, over the whole window, and
 * asking again would return the same number at a later instant — which is an
 * aggregate that can disagree with the page it is compared against for reasons
 * that are not redaction.
 */
function memberOf(value: unknown): MemberHours | null {
  const parsed = followedMemberSchema.safeParse(value)

  if (!parsed.success || parsed.data === null) {
    return null
  }

  const node = parsed.data
  const { nodes, pageInfo } = node.timelogs

  return {
    declared: null,
    entries: nodes
      .filter((one) => one !== null)
      .map((one) => toTimelogEntry(one))
      .filter((entry) => entry !== null),
    // From `hasNextPage` alone. The provider computes it before removing what
    // the reader may not read, so a round can carry no nodes and still have
    // more after it — stopping on an empty one would abandon the rest.
    nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
    person: toPerson(node),
  }
}

async function readBatch(
  reader: Reader,
  query: TeamFollowingQuery,
  cursors: TeamFollowingQuery['cursors'],
): Promise<readonly MemberHours[]> {
  const answer = await ask(reader, teamHoursFollowing(cursors.length), {
    first: PAGE_SIZE,
    from: query.from,
    group: query.groupId,
    to: query.to,
    ...aliasVariables(cursors),
  })
  const payload = teamFollowingPayloadSchema.parse(answer.data)

  return cursors
    .map((_cursor, index) => memberOf(payload[followAlias(index)]))
    .filter((member) => member !== null)
}
