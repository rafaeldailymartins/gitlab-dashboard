import type { GroupTimelogEntry, Person, RosterMember } from './types'

/** One person who gets a row, and whether the group lists them as a member. */
export interface RosterRow {
  /** False for somebody who logged time here but is not on the membership. */
  readonly onRoster: boolean
  readonly person: Person
}

/**
 * Everybody who should have a row: the group's members, plus anyone who logged
 * time in it and is not — or is no longer — one.
 *
 * The membership half is filtered. A bot has no hours to account for, and a
 * blocked account is clutter in a grid whose whole point is finding the person
 * who did not log.
 *
 * The observed half is never filtered. Somebody who left the group mid-month
 * still logged those hours, and dropping their row would take the hours out of
 * every total with it — a total that silently disagrees with the group's own is
 * worse than a row the reader has to explain.
 *
 * Identity is the provider's user id, not the username: a username can be
 * changed, and two answers about the same person would then become two rows.
 */
export function people(
  roster: readonly RosterMember[],
  entries: readonly GroupTimelogEntry[],
): RosterRow[] {
  const rows = new Map<string, RosterRow>()

  for (const member of roster) {
    if (member.active && !member.bot) {
      rows.set(member.person.id, { onRoster: true, person: member.person })
    }
  }

  for (const entry of entries) {
    if (!rows.has(entry.person.id)) {
      rows.set(entry.person.id, { onRoster: false, person: entry.person })
    }
  }

  return [...rows.values()].toSorted(byNameThenUsername)
}

/**
 * Ordered by name, then by username to break a tie between two people who share
 * one.
 *
 * Plain code-unit comparison rather than `localeCompare`: the model may not read
 * a locale, and an ordering that depended on the ambient one would put a domain
 * test at the mercy of the machine running it. Ordering for a human to read is
 * presentation, and the table does it in the interface.
 */
function byNameThenUsername(left: RosterRow, right: RosterRow): number {
  if (left.person.name === right.person.name) {
    return left.person.username < right.person.username ? -1 : 1
  }

  return left.person.name < right.person.name ? -1 : 1
}
