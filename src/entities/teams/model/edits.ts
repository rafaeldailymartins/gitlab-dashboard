import type { Team, TeamMember } from './team'

import { isValidTeamName, MAX_MEMBERS, MAX_TEAMS } from './team'

/**
 * Every edit a reader can make to a team, as a total function over a team.
 *
 * Each returns a fresh team rather than mutating one, and each is total: there
 * is no edit that throws and no edit that half-applies. A refused edit returns
 * the team it was given, so a caller that ignores the result is wrong about
 * nothing — the interface can then decide whether to say so.
 *
 * `at` is passed in rather than read from a clock, because the model may not
 * reach for one. It is the instant the change is being made.
 */

/** A team with nobody on it yet. `id` is minted by the caller. */
export function newTeam(id: string, name: string, at: string): Team {
  return { id, members: [], name: name.trim(), updatedAt: at }
}

/**
 * The same team with one more person on it.
 *
 * Adding somebody already there is a no-op rather than a duplicate row: two
 * rows for one person would count their hours twice in every total, which is
 * the one way a roster can make a figure wrong.
 */
export function withMember(team: Team, member: TeamMember, at: string): Team {
  if (team.members.some((one) => one.id === member.id) || team.members.length >= MAX_MEMBERS) {
    return team
  }

  return { ...team, members: [...team.members, member], updatedAt: at }
}

/**
 * The same team with several more people on it, in one change.
 *
 * One edit rather than a fold of `withMember`, because a team built from a group
 * is one decision and has to be one save: every `apply` here is a conditional
 * write against a version, so a dozen of them is a dozen chances for one to be
 * refused and leave the reader half the squad they asked for.
 *
 * The ceiling stops it mid-list rather than refusing the lot. A group with more
 * contributors than a team may hold still gives the reader a usable team, and the
 * ones that did not fit are reachable by name — where refusing outright would
 * leave them nothing at all.
 *
 * Adding nobody returns the team it was given, dated as it was. Every write here
 * carries a version, and one that changed no member but moved the instant is a
 * conflict manufactured out of nothing.
 */
export function withMembers(team: Team, members: readonly TeamMember[], at: string): Team {
  const added = members.filter(
    (one, index) =>
      members.findIndex((other) => other.id === one.id) === index &&
      !team.members.some((already) => already.id === one.id),
  )

  if (added.length === 0) {
    return team
  }

  return {
    ...team,
    members: [...team.members, ...added].slice(0, MAX_MEMBERS),
    updatedAt: at,
  }
}

/** The same team under another name. A name the endpoint would refuse is refused here. */
export function withName(team: Team, name: string, at: string): Team {
  return isValidTeamName(name) ? { ...team, name: name.trim(), updatedAt: at } : team
}

/** The same team with one person taken off. Removing a stranger changes nothing. */
export function withoutMember(team: Team, memberId: string, at: string): Team {
  const members = team.members.filter((one) => one.id !== memberId)

  return members.length === team.members.length ? team : { ...team, members, updatedAt: at }
}

/** The reader's teams with one deleted. */
export function withoutTeam(teams: readonly Team[], teamId: string): readonly Team[] {
  return teams.filter((one) => one.id !== teamId)
}

/** The reader's teams with one more. Past the ceiling, unchanged. */
export function withTeam(teams: readonly Team[], team: Team): readonly Team[] {
  return teams.length >= MAX_TEAMS || teams.some((one) => one.id === team.id)
    ? teams
    : [...teams, team]
}

/** The reader's teams with one replaced, matched on its identifier. */
export function withUpdated(teams: readonly Team[], team: Team): readonly Team[] {
  return teams.map((one) => (one.id === team.id ? team : one))
}
