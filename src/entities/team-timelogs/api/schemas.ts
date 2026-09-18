// zod 4's documented import form. The named `z` binding does not survive Vite's
// interop for this package, so the namespace import is also the one that works.
import * as z from 'zod'

import type { GroupRef, Person, SuggestedMember, TeamTimelogEntry } from '../model/types'

/**
 * The shapes GitLab returns, parsed at the boundary.
 *
 * Every field GitLab declares nullable is nullable here, even where it is
 * always present in practice. The connection's nodes are nullable for the same
 * reason the personal schemas' are: one null must not take a whole page with it.
 */
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  webUrl: z.string(),
})

const pageInfoSchema = z.object({
  endCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
})

const timelogSchema = z.object({
  id: z.string(),
  /** Nullable in GitLab's schema; an entry with no instant belongs to no day. */
  spentAt: z.string().nullable(),
  timeSpent: z.number(),
})

/**
 * `count` is an `Int`, `totalSpentTime` a `BigInt` — which GraphQL serialises as
 * a **string**. Coerced here so nothing downstream can concatenate it.
 */
const declaredSchema = z.object({
  count: z.number(),
  totalSpentTime: z.coerce.number(),
})

/** One person's entries within one round, with the aggregates on the first. */
const memberTimelogsSchema = z.object({
  count: z.number().optional(),
  nodes: z.array(timelogSchema.nullable()),
  pageInfo: pageInfoSchema,
  totalSpentTime: z.coerce.number().optional(),
})

const memberNodeSchema = userSchema.extend({ timelogs: memberTimelogsSchema })

export const teamHoursPagePayloadSchema = z.object({
  users: z
    .object({
      nodes: z.array(memberNodeSchema.nullable()),
      pageInfo: z.object({ hasNextPage: z.boolean() }),
    })
    .nullable(),
})

/**
 * The continuation, whose aliases the caller named.
 *
 * `catchall` is what lets the dynamic `a0`, `a1`… survive parsing; each is then
 * checked on its own against `followedMemberSchema`.
 */
export const teamFollowingPayloadSchema = z.object({}).catchall(z.unknown())

export const followedMemberSchema = userSchema.extend({ timelogs: memberTimelogsSchema }).nullable()

export const teamColumnProbePayloadSchema = z.object({
  user: z.object({ id: z.string(), period: declaredSchema }).catchall(z.unknown()).nullable(),
})

/** One column's totals, read from an alias whose name the caller chose. */
export const declaredTotalsSchema = declaredSchema

const suggestionNodeSchema = z.object({
  user: userSchema.extend({ bot: z.boolean(), state: z.string() }).nullable(),
})

export const groupSuggestionsPayloadSchema = z.object({
  group: z
    .object({
      timelogs: z.object({
        nodes: z.array(suggestionNodeSchema.nullable()),
        pageInfo: pageInfoSchema,
      }),
    })
    .nullable(),
})

const groupRefSchema = z.object({
  fullPath: z.string(),
  id: z.string(),
  /** `Group.name` is nullable; the path is not, and is a usable stand-in. */
  name: z.string().nullable(),
})

export const myGroupsPayloadSchema = z.object({
  groups: z.object({ nodes: z.array(groupRefSchema.nullable()) }).nullable(),
})

export const peopleSearchPayloadSchema = z.object({
  users: z.object({ nodes: z.array(userSchema.nullable()) }).nullable(),
})

type GroupRefPayload = z.infer<typeof groupRefSchema>
type MemberNode = z.infer<typeof memberNodeSchema>
type SuggestionNode = z.infer<typeof suggestionNodeSchema>
type Timelog = z.infer<typeof timelogSchema>
type User = z.infer<typeof userSchema>

/** The aggregates, or null on a round that did not carry them. */
export function toDeclared(
  timelogs: MemberNode['timelogs'],
): null | { entryCount: number; seconds: number } {
  return timelogs.count === undefined || timelogs.totalSpentTime === undefined
    ? null
    : { entryCount: timelogs.count, seconds: timelogs.totalSpentTime }
}

/** The group's name falls back to its path, which is never absent. */
export function toGroupRef(group: GroupRefPayload): GroupRef {
  return { fullPath: group.fullPath, id: group.id, name: group.name ?? group.fullPath }
}

export function toPerson(user: User): Person {
  return { id: user.id, name: user.name, username: user.username, webUrl: user.webUrl }
}

/**
 * Somebody the provider described, offered as a candidate for a team.
 *
 * Null when it would not resolve the user: an entry with nobody behind it is a
 * suggestion with no name, which is worse than no suggestion.
 */
export function toSuggestedMember(node: SuggestionNode): null | SuggestedMember {
  if (!node.user) {
    return null
  }

  return {
    active: node.user.state === 'active',
    bot: node.user.bot,
    person: toPerson(node.user),
  }
}

/**
 * A timelog as the rules want it.
 *
 * Null when GitLab reported no instant: which day such an entry belongs to is
 * unknowable, and placing it anywhere would be an invention. It is still
 * counted, by the difference against the window's own total.
 */
export function toTimelogEntry(timelog: Timelog): null | TeamTimelogEntry {
  if (timelog.spentAt === null) {
    return null
  }

  return { id: timelog.id, seconds: timelog.timeSpent, spentAt: new Date(timelog.spentAt) }
}

export const groupRefPayloadSchema = z.object({ group: groupRefSchema.nullable() })
