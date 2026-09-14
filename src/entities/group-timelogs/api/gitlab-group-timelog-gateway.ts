import { type GraphQLClient, GraphQLRequestError } from '@/shared/api'

import type {
  DeclaredTotals,
  GroupHoursPage,
  GroupHoursQuery,
  GroupProbe,
  GroupQuery,
  GroupTimelogGateway,
  ProbeQuery,
  RosterAnswer,
} from '../model/ports'
import type { GroupRef, RosterMember } from '../model/types'

import { readColumnProbe } from './column-probe'
import {
  GROUP_HOURS_PAGE,
  GROUP_ROSTER,
  groupMonthProbe,
  MY_GROUPS,
  probeAlias,
  probeVariable,
} from './documents'
import {
  declaredTotalsSchema,
  groupHoursPagePayloadSchema,
  groupProbePayloadSchema,
  groupRosterPayloadSchema,
  myGroupsPayloadSchema,
  toGroupAccess,
  toGroupRef,
  toGroupTimelogEntry,
  toRosterMember,
} from './schemas'

/** GitLab's own default maximum page size. Asking for more is silently capped. */
const PAGE_SIZE = 100

/** How many groups the picker offers before asking the reader to narrow down. */
const GROUP_RESULTS = 20

/**
 * How many people one probe request asks about.
 *
 * Each alias costs 7 of GitLab's 250-point complexity budget, and the rest of
 * the document costs about 10. Thirty-two leaves room to spare rather than
 * discovering the ceiling in production.
 */
const PROBE_BATCH = 32

/**
 * The client and the caller’s abort signal, travelling together.
 *
 * They are one thing — how to reach GitLab for this request — and threading
 * them separately put four of the readers below over the parameter ceiling.
 */
interface Reader {
  readonly client: GraphQLClient
  readonly signal: AbortSignal | undefined
}

/**
 * Reads a group's logged hours from GitLab.
 *
 * Thin on purpose: every method delegates to a top-level function, so no one of
 * them carries the whole adapter and each reads on its own.
 */
export function gitLabGroupTimelogGateway(client: GraphQLClient): GroupTimelogGateway {
  return {
    columns: async (query, signal) => readColumnProbe(client, query, signal),
    groups: async (search, signal) => readGroups({ client, signal }, search),
    probe: async (query, signal) => readProbe({ client, signal }, query),
    roster: async (query, signal) => readRoster({ client, signal }, query),
    timelogs: async (query, signal) => readPage({ client, signal }, query),
  }
}

async function ask(reader: Reader, query: string, variables: Record<string, unknown>) {
  return reader.client.request({
    query,
    variables,
    ...(reader.signal ? { signal: reader.signal } : {}),
  })
}

function batched(usernames: readonly string[], size: number): readonly string[][] {
  if (usernames.length === 0) {
    return [[]]
  }

  return Array.from({ length: Math.ceil(usernames.length / size) }, (_unused, index) =>
    usernames.slice(index * size, (index + 1) * size),
  )
}

function declaredOf(window: { count: number; totalSpentTime: number }): DeclaredTotals {
  return { entryCount: window.count, seconds: window.totalSpentTime }
}

/**
 * The batches as one answer.
 *
 * Every batch asks the same window, so they all report the same aggregates and
 * the same access; only the per-person totals differ, and those are gathered.
 */
function merged(answers: readonly GroupProbe[]): GroupProbe {
  const first = answers.at(0) ?? NOTHING_KNOWN

  return {
    access: first.access,
    declared: first.declared,
    group: first.group,
    perPerson: new Map(answers.flatMap((answer) => [...answer.perPerson])),
  }
}

function pageVariables(query: GroupHoursQuery): Record<string, unknown> {
  return { after: query.after, first: PAGE_SIZE, ...windowVariables(query) }
}

function perPersonOf(
  group: Record<string, unknown>,
  usernames: readonly string[],
): ReadonlyMap<string, DeclaredTotals> {
  const totals = new Map<string, DeclaredTotals>()

  for (const [index, username] of usernames.entries()) {
    const parsed = declaredTotalsSchema.safeParse(group[probeAlias(index)])

    if (parsed.success) {
      totals.set(username, declaredOf(parsed.data))
    }
  }

  return totals
}

/** The groups the reader may open. */
async function readGroups(reader: Reader, search: null | string): Promise<readonly GroupRef[]> {
  const answer = await ask(reader, MY_GROUPS, { first: GROUP_RESULTS, search })
  const { groups } = myGroupsPayloadSchema.parse(answer.data)

  return (groups?.nodes ?? []).filter((node) => node !== null).map((node) => toGroupRef(node))
}

/**
 * One page of entries.
 *
 * `nextCursor` comes from `hasNextPage` alone. GitLab computes it before it
 * removes the entries the reader may not read, so a page can legitimately carry
 * no nodes and still have more after it — stopping on an empty page would
 * abandon the rest of the month.
 */
async function readPage(reader: Reader, query: GroupHoursQuery): Promise<GroupHoursPage> {
  const answer = await ask(reader, GROUP_HOURS_PAGE, pageVariables(query))
  const { group } = groupHoursPagePayloadSchema.parse(answer.data)

  refuseWhenUnreadable(group, answer.errors)

  if (!group) {
    return { entries: [], group: null, nextCursor: null }
  }

  const { nodes, pageInfo } = group.timelogs

  return {
    entries: nodes
      .filter((node) => node !== null)
      .map((node) => toGroupTimelogEntry(node))
      .filter((entry) => entry !== null),
    group: toGroupRef(group),
    nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
  }
}

/**
 * The window's aggregates, the reader's access, and each person's own total.
 *
 * Asked in batches so a large group does not exceed GitLab's complexity budget,
 * and keyed back by the positions the request sent: the connection carries no
 * field naming who it is about.
 */
async function readProbe(reader: Reader, query: ProbeQuery): Promise<GroupProbe> {
  const answers: GroupProbe[] = []

  for (const batch of batched(query.usernames ?? [], PROBE_BATCH)) {
    answers.push(await readProbeBatch(reader, query, batch))
  }

  return merged(answers)
}

/** What a probe reports about a group it could not read. */
const NOTHING_KNOWN: GroupProbe = {
  access: null,
  declared: { entryCount: 0, seconds: 0 },
  group: null,
  perPerson: new Map(),
}

async function readProbeBatch(
  reader: Reader,
  query: ProbeQuery,
  usernames: readonly string[],
): Promise<GroupProbe> {
  const variables = { ...windowVariables(query), ...usernameVariables(usernames) }
  const answer = await ask(reader, groupMonthProbe(usernames), variables)
  const { group } = groupProbePayloadSchema.parse(answer.data)

  refuseWhenUnreadable(group, answer.errors)

  if (!group) {
    return NOTHING_KNOWN
  }

  return {
    access: toGroupAccess(group.maxAccessLevel),
    declared: declaredOf(group.window),
    group: toGroupRef(group),
    perPerson: perPersonOf(group, usernames),
  }
}

/**
 * Every member, read to exhaustion here rather than paged by the screen.
 *
 * The roster is what gives somebody who logged nothing a row, so a group whose
 * membership runs past one page would otherwise silently lose exactly the
 * people the screen exists to surface.
 */
async function readRoster(reader: Reader, query: GroupQuery): Promise<RosterAnswer> {
  const members: RosterMember[] = []
  let access = null
  let group: GroupRef | null = null
  let after: null | string = null

  do {
    const page = await readRosterPage(reader, query, after)

    members.push(...page.members)
    access = page.access
    group = page.group
    after = page.nextCursor
  } while (after !== null)

  return { access, group, members }
}

async function readRosterPage(
  reader: Reader,
  query: GroupQuery,
  after: null | string,
): Promise<RosterAnswer & { nextCursor: null | string }> {
  const variables = { after, first: PAGE_SIZE, fullPath: query.fullPath }
  const answer = await ask(reader, GROUP_ROSTER, variables)
  const { group } = groupRosterPayloadSchema.parse(answer.data)

  refuseWhenUnreadable(group, answer.errors)

  if (!group) {
    return { access: null, group: null, members: [], nextCursor: null }
  }

  const { nodes, pageInfo } = group.groupMembers

  return {
    access: toGroupAccess(group.maxAccessLevel),
    group: toGroupRef(group),
    members: nodes
      .filter((node) => node !== null)
      .map((node) => toRosterMember(node))
      .filter((member) => member !== null),
    nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
  }
}

/**
 * A group of `null` with errors beside it is a refusal, not an empty group.
 *
 * With no errors it means GitLab resolved no such group for this reader, which
 * the screen says plainly. With errors, something it could not resolve took the
 * whole group with it — and a refusal is not an empty report.
 */
function refuseWhenUnreadable(group: unknown, errors: readonly string[]): void {
  if (group === null && errors.length > 0) {
    throw new GraphQLRequestError({ kind: 'rejected', messages: errors })
  }
}

function usernameVariables(usernames: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(usernames.map((username, index) => [probeVariable(index), username]))
}

function windowVariables(query: ProbeQuery): Record<string, unknown> {
  return { from: query.from, fullPath: query.fullPath, to: query.to }
}
