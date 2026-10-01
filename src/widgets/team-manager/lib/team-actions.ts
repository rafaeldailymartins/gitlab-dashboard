import type { Team, TeamMember } from '@/entities/teams'

import { withMember, withName, withoutMember, withoutTeam, withUpdated } from '@/entities/teams'

import type { TeamEdits } from './use-team-edits'

/** Every change a reader can make to the team in front of them. */
export interface TeamActions {
  readonly onAdd: (member: TeamMember) => void
  readonly onDelete: () => void
  readonly onRemove: (member: TeamMember) => void
  readonly onRename: (name: string) => void
}

/** The instant an edit is made at. The model may not reach for a clock. */
export function nowInstant(): string {
  return new Date().toISOString()
}

/**
 * The four edits, bound to the team on screen.
 *
 * Here rather than inline in the markup: every one of them is the same shape —
 * apply a pure edit from the model to the whole list being edited — and four of
 * those inside a JSX tree buries the layout under them.
 *
 * Every one goes through `entities/teams`' own edit functions rather than
 * building a team by hand. Each of those is total and each refuses what the
 * store would refuse, so a rename that is only whitespace changes nothing here
 * for the same reason it would change nothing there.
 *
 * Deleting clears the chosen team first, so the screen falls back to whatever is
 * left rather than briefly holding a team that no longer exists.
 */
export function teamActions(
  edits: TeamEdits,
  team: null | Team,
  choose: (id: null | string) => void,
): TeamActions {
  return {
    onAdd: (member) => {
      if (team) {
        edits.apply((teams) => withUpdated(teams, withMember(team, member, nowInstant())))
      }
    },
    onDelete: () => {
      if (team) {
        choose(null)
        edits.apply((teams) => withoutTeam(teams, team.id))
      }
    },
    onRemove: (member) => {
      if (team) {
        edits.apply((teams) => withUpdated(teams, withoutMember(team, member.id, nowInstant())))
      }
    },
    onRename: (name) => {
      if (team) {
        edits.apply((teams) => withUpdated(teams, withName(team, name, nowInstant())))
      }
    },
  }
}
