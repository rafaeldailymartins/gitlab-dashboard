// zod 4's documented import form. The named `z` binding does not survive Vite's
// interop for this package, so the namespace import is also the one that works.
import * as z from 'zod'

import type { GroupAccess, GroupRef, GroupTimelogEntry, Person, RosterMember } from '../model/types'

/**
 * The shapes GitLab returns, parsed at the boundary.
 *
 * Every field GitLab declares nullable is nullable here, even where it is
 * always present in practice. The connection's nodes are nullable for the same
 * reason the personal schemas' are: one null must not take a whole page with
 * it.
 */
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  webUrl: z.string(),
})

const accessLevelSchema = z.object({
  integerValue: z.number().nullable(),
  stringValue: z.string().nullable(),
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
  user: userSchema,
})

/** `Group.name` is nullable; the path is not, and is a usable stand-in. */
const groupRefSchema = z.object({
  fullPath: z.string(),
  name: z.string().nullable(),
})

export const groupHoursPagePayloadSchema = z.object({
  group: groupRefSchema
    .extend({
      timelogs: z.object({
        nodes: z.array(timelogSchema.nullable()),
        pageInfo: pageInfoSchema,
      }),
    })
    .nullable(),
})

/**
 * `count` is an `Int`, `totalSpentTime` a `BigInt` — which GraphQL serialises as
 * a **string**. Coerced here so nothing downstream can concatenate it.
 */
const declaredSchema = z.object({
  count: z.number(),
  totalSpentTime: z.coerce.number(),
})

export const groupProbePayloadSchema = z.object({
  group: groupRefSchema
    .extend({ maxAccessLevel: accessLevelSchema.nullable(), window: declaredSchema })
    .catchall(z.unknown())
    .nullable(),
})

export const groupColumnProbePayloadSchema = z.object({
  group: groupRefSchema.extend({ period: declaredSchema }).catchall(z.unknown()).nullable(),
})

const memberSchema = z.object({
  accessLevel: accessLevelSchema.nullable(),
  user: userSchema.extend({ bot: z.boolean(), state: z.string() }).nullable(),
})

export const groupRosterPayloadSchema = z.object({
  group: groupRefSchema
    .extend({
      groupMembers: z.object({
        nodes: z.array(memberSchema.nullable()),
        pageInfo: pageInfoSchema,
      }),
      maxAccessLevel: accessLevelSchema.nullable(),
    })
    .nullable(),
})

export const myGroupsPayloadSchema = z.object({
  groups: z.object({ nodes: z.array(groupRefSchema.nullable()) }).nullable(),
})

/** One person's totals, read from an alias whose name the caller chose. */
export const declaredTotalsSchema = declaredSchema

type AccessLevel = z.infer<typeof accessLevelSchema>
type GroupRefPayload = z.infer<typeof groupRefSchema>
type Member = z.infer<typeof memberSchema>
type Timelog = z.infer<typeof timelogSchema>
type User = z.infer<typeof userSchema>

/** GitLab's own name for the level, or nothing when it would not say. */
export function toGroupAccess(level: AccessLevel | null): GroupAccess | null {
  if (level === null) {
    return null
  }

  const { integerValue, stringValue } = level

  // Both halves or neither: a level with a number and no name, or a name and no
  // number, is not something the screen can say anything useful about.
  if (integerValue === null || stringValue === null) {
    return null
  }

  return { level: integerValue, name: stringValue }
}

/** The group's name falls back to its path, which is never absent. */
export function toGroupRef(group: GroupRefPayload): GroupRef {
  return { fullPath: group.fullPath, name: group.name ?? group.fullPath }
}

/**
 * A timelog as the rules want it.
 *
 * Null when GitLab reported no instant: which day such an entry belongs to is
 * unknowable, and placing it anywhere would be an invention. It is still
 * counted, by the difference against the window's own total.
 */
export function toGroupTimelogEntry(timelog: Timelog): GroupTimelogEntry | null {
  if (timelog.spentAt === null) {
    return null
  }

  return {
    id: timelog.id,
    person: toPerson(timelog.user),
    seconds: timelog.timeSpent,
    spentAt: new Date(timelog.spentAt),
  }
}

/**
 * A member GitLab was willing to describe.
 *
 * Null when it would not resolve the user: a membership with nobody behind it
 * is a row with no name, which is worse than no row.
 */
export function toRosterMember(member: Member): null | RosterMember {
  if (!member.user) {
    return null
  }

  return {
    access: toGroupAccess(member.accessLevel),
    active: member.user.state === 'active',
    bot: member.user.bot,
    person: toPerson(member.user),
  }
}

function toPerson(user: User): Person {
  return { id: user.id, name: user.name, username: user.username, webUrl: user.webUrl }
}
