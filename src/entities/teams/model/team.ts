import { byNameThenUsername } from '@/shared/lib/people'

/** A list of people the reader keeps, and reports on. */
export interface Team {
  /**
   * This app's own identifier, distinct from the name.
   *
   * It is what an address to a team names, so renaming does not change what a
   * link means — and it is what a shared team would later be addressed by, so
   * sharing can be added without a rename becoming a redirect.
   */
  readonly id: string
  readonly members: readonly TeamMember[]
  readonly name: string
  /** An ISO instant. */
  readonly updatedAt: string
}

/**
 * Somebody the reader put on a team.
 *
 * Stored by the identifier the provider says cannot change, with the username
 * beside it as the address and the name as what the reader last saw. A username
 * is released when an account is renamed and another account may claim it, so a
 * roster matched on one alone can come to point at a different person with
 * nothing on screen to say so.
 *
 * `webUrl` is deliberately absent: it is derivable from the username and the
 * instance, and storing it would put a second source of truth for the host
 * inside the document.
 */
export interface TeamMember {
  readonly id: string
  readonly name: string
  readonly username: string
}

export const TEAMS_VERSION = 1

/**
 * What a team whose stored instant is unreadable is dated instead.
 *
 * Repairing beats dropping here, and beats keeping the bad value. Every edit
 * writes a fresh instant, but a save carries the whole document — so one team
 * with an unusable date would make every future save of *any* team fail the
 * endpoint's check, which is a stuck state a reader cannot see the cause of.
 * The epoch is a real instant and plainly means nobody knows.
 */
const UNKNOWN_INSTANT = '1970-01-01T00:00:00.000Z'

/**
 * The bounds, which are also the endpoint's.
 *
 * Stated twice on purpose. The endpoint enforces them because it is reachable by
 * anyone holding a valid identity assertion, including this reader's own
 * compromised tab; these exist so the interface refuses before a round trip
 * rather than after one. `tests/contract/` is what keeps the two agreeing.
 */
export const MAX_TEAMS = 50
export const MAX_MEMBERS = 200
export const MAX_NAME_LENGTH = 100

/**
 * Mirrors the shape the endpoint will accept, deliberately.
 *
 * A team whose identifier this rejects is one that could never be saved, and
 * showing the reader a team they cannot edit is worse than not showing it: the
 * failure would arrive later, on their change, with no way back.
 *
 * Deliberately a *subset* of what the endpoint accepts rather than an exact
 * match — it leaves out the nil identifier, which nothing here mints. Erring
 * that way is safe: everything this accepts, the endpoint accepts too. Erring
 * the other way is the stuck state above.
 */
const IDENTIFIER = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/iu

const USERNAME = /^[\w.-]{1,255}$/u

/**
 * Reads teams back, from the store or from the device.
 *
 * Anything unusable is dropped rather than thrown, and dropped at the smallest
 * scope that makes sense: one unreadable member costs the reader that member and
 * not the team, one unreadable team costs them that team and not the rest. The
 * same reasoning as `decodePreferences`.
 *
 * This is the lenient half of a deliberate pair. The endpoint refuses on write
 * what this recovers on read, because the two answer different questions: this
 * is recovering from something already stored, and that is deciding what may be
 * stored at all.
 */
export function decodeTeams(stored: null | string): readonly Team[] {
  const source = parseObject(stored)
  const teams = source['teams']

  if (!Array.isArray(teams)) {
    return []
  }

  return teams
    .map((team: unknown) => teamFrom(team))
    .filter((team) => team !== null)
    .slice(0, MAX_TEAMS)
}

export function encodeTeams(teams: readonly Team[]): string {
  return JSON.stringify({ teams, version: TEAMS_VERSION })
}

export function isValidTeamName(name: string): boolean {
  const trimmed = name.trim()

  return trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH
}

/** The team's people, in the order a reader reads them. */
export function orderedMembers(team: Team): readonly TeamMember[] {
  return team.members.toSorted(byNameThenUsername)
}

function memberFrom(source: unknown): null | TeamMember {
  if (typeof source !== 'object' || source === null) {
    return null
  }

  const { id, name, username } = source as Record<string, unknown>

  if (!nonEmpty(id) || !nonEmpty(name) || !nonEmpty(username) || !USERNAME.test(username)) {
    return null
  }

  return { id, name, username }
}

/** Members of one team, deduplicated by identifier and capped. */
function membersFrom(source: unknown): readonly TeamMember[] {
  if (!Array.isArray(source)) {
    return []
  }

  const byId = new Map<string, TeamMember>()

  for (const candidate of source) {
    const member = memberFrom(candidate)

    // First writing wins. A duplicate would count somebody's hours twice in
    // every total, which is the one way this list can produce a wrong figure.
    if (member !== null && !byId.has(member.id)) {
      byId.set(member.id, member)
    }
  }

  return [...byId.values()].slice(0, MAX_MEMBERS)
}

/** A string with something in it. */
function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

function parseObject(stored: null | string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(stored ?? '')

    return typeof parsed === 'object' && parsed !== null ? { ...parsed } : {}
  } catch {
    return {}
  }
}

function teamFrom(source: unknown): null | Team {
  if (typeof source !== 'object' || source === null) {
    return null
  }

  const { id, members, name, updatedAt } = source as Record<string, unknown>

  if (typeof id !== 'string' || !IDENTIFIER.test(id) || typeof name !== 'string') {
    return null
  }

  return isValidTeamName(name)
    ? {
        id,
        members: membersFrom(members),
        name: name.trim(),
        updatedAt: usableInstant(updatedAt) ? updatedAt : UNKNOWN_INSTANT,
      }
    : null
}

/** An instant the endpoint would also accept, which is the point of checking. */
function usableInstant(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) && value.includes('T')
}
