import { type GraphQLClient, GraphQLRequestError } from '@/shared/api'

import type { MemberHours, TeamHoursPage, TeamHoursQuery, TeamTimelogGateway } from '../model/ports'
import type { GroupRef, Person } from '../model/types'

import { readColumnProbe } from './column-probe'
import { TEAM_HOURS_PAGE } from './documents'
import { readFollowing } from './following'
import { ask, PAGE_SIZE, type Reader } from './reader'
import {
  groupRefPayloadSchema,
  myGroupsPayloadSchema,
  peopleSearchPayloadSchema,
  teamHoursPagePayloadSchema,
  toDeclared,
  toGroupRef,
  toPerson,
  toTimelogEntry,
} from './schemas'
import { GROUP_REF, MY_GROUPS, PEOPLE_SEARCH } from './suggestion-documents'
import { readSuggestions } from './suggestion-reader'

/** How many groups or people a picker offers before asking the reader to narrow. */
const PICKER_RESULTS = 20

/**
 * How many people one round asks about.
 *
 * Not a complexity constant: measured against the real provider, the document
 * scores 26 points of 250 for one person and 29 for sixteen, because complexity
 * counts fields rather than rows. This is the connection's own page cap, which
 * is the only thing that actually bounds it.
 */
const TEAM_BATCH = PAGE_SIZE

type MemberNode = NonNullable<
  NonNullable<ReturnType<typeof teamHoursPagePayloadSchema.parse>['users']>['nodes'][number]
>

/**
 * Reads a team's logged hours from GitLab.
 *
 * Thin on purpose: every method delegates to a function of its own, so no one of
 * them carries the whole adapter and each reads on its own.
 */
export function gitLabTeamTimelogGateway(client: GraphQLClient): TeamTimelogGateway {
  return {
    columns: async (query, signal) => readColumnProbe({ client, signal }, query),
    following: async (query, signal) => readFollowing({ client, signal }, query),
    group: async (fullPath, signal) => readGroup({ client, signal }, fullPath),
    groups: async (search, signal) => readGroups({ client, signal }, search),
    people: async (search, signal) => readPeople({ client, signal }, search),
    suggestions: async (query, signal) => readSuggestions({ client, signal }, query),
    timelogs: async (query, signal) => readRound({ client, signal }, query),
  }
}

/**
 * One person's answer.
 *
 * The aggregates ride on this round rather than in a separate probe, which is a
 * correctness gain and not only a saving: a connection's aggregate and its nodes
 * are the same relation under the same range, so read in one field they cannot
 * disagree about which entries they cover.
 */
function memberOf(node: MemberNode): MemberHours {
  const { nodes, pageInfo } = node.timelogs

  return {
    declared: toDeclared(node.timelogs),
    entries: nodes
      .filter((one) => one !== null)
      .map((one) => toTimelogEntry(one))
      .filter((entry) => entry !== null),
    // From `hasNextPage` alone: the provider computes it before removing what
    // the reader may not read, so a round can carry no nodes and still have more
    // after it, and stopping on an empty one would abandon the rest.
    nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
    person: toPerson(node),
  }
}

/**
 * The group an address names, or null when this reader cannot open it.
 *
 * Null is a fact the screen reports rather than an error: a link naming a group
 * the recipient has no access to must not silently widen into their whole reach
 * under a caption that says otherwise.
 */
async function readGroup(reader: Reader, fullPath: string): Promise<GroupRef | null> {
  const answer = await ask(reader, GROUP_REF, { fullPath })
  const { group } = groupRefPayloadSchema.parse(answer.data)

  return group === null ? null : toGroupRef(group)
}

/** The groups the reader may open, for the filter and for seeding a team. */
async function readGroups(reader: Reader, search: null | string): Promise<readonly GroupRef[]> {
  const answer = await ask(reader, MY_GROUPS, { first: PICKER_RESULTS, search })
  const { groups } = myGroupsPayloadSchema.parse(answer.data)

  return (groups?.nodes ?? []).filter((node) => node !== null).map((node) => toGroupRef(node))
}

/** People the provider can find, for putting one on a team by name. */
async function readPeople(reader: Reader, search: string): Promise<readonly Person[]> {
  const answer = await ask(reader, PEOPLE_SEARCH, { first: PICKER_RESULTS, search })
  const { users } = peopleSearchPayloadSchema.parse(answer.data)

  return (users?.nodes ?? []).filter((node) => node !== null).map((node) => toPerson(node))
}

/**
 * The first round: every person's window, their aggregates, and who resolved.
 *
 * One request for the whole team. Measured, chunking it into concurrent
 * requests saved about half a second on sixteen people against one request for
 * all of them — not worth a constant, so there is none.
 *
 * `users.pageInfo.hasNextPage` is read only to refuse: `first` is the batch's
 * own length, so it should never be true, and a report that quietly omitted
 * somebody would be worse than one that failed.
 */
async function readRound(reader: Reader, query: TeamHoursQuery): Promise<TeamHoursPage> {
  const ids = query.members.map((member) => member.id)
  const answer = await ask(reader, TEAM_HOURS_PAGE, {
    first: PAGE_SIZE,
    from: query.from,
    group: query.groupId,
    ids,
    people: Math.min(ids.length, TEAM_BATCH),
    to: query.to,
  })
  const { users } = teamHoursPagePayloadSchema.parse(answer.data)

  refuseWhenUnreadable(users, answer.errors)

  if (!users) {
    return { members: [] }
  }

  if (users.pageInfo.hasNextPage) {
    throw new GraphQLRequestError({
      kind: 'rejected',
      messages: ['the provider returned fewer people than the team names'],
    })
  }

  return { members: users.nodes.filter((node) => node !== null).map((node) => memberOf(node)) }
}

/**
 * A null answer with errors beside it is a refusal, not an empty one.
 *
 * With no errors it means the provider resolved nobody, which the screen says
 * plainly. With errors, something it could not resolve took the whole answer
 * with it — and a refusal is not an empty report.
 */
function refuseWhenUnreadable(users: unknown, errors: readonly string[]): void {
  if (users === null && errors.length > 0) {
    throw new GraphQLRequestError({ kind: 'rejected', messages: errors })
  }
}
