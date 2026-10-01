import { useState } from 'react'

import type { GroupRef } from '@/entities/team-timelogs'
import type { Team, TeamMember } from '@/entities/teams'

import { newTeam, withMembers, withTeam, withUpdated } from '@/entities/teams'
import { m } from '@/shared/i18n'

import type { Seeding } from './use-group-seeding'
import type { TeamDraft } from './use-team-draft'

import { nowInstant } from './team-actions'

export interface ManagerState {
  readonly choose: (id: string) => void
  readonly chosen: null | Team
  /** Forgets which team was chosen, for the one deleted out from under the pane. */
  readonly clear: () => void
  readonly pane: Pane
  readonly show: (pane: Pane) => void
  /** Reads a group and puts whoever logged time there on a team. */
  readonly useGroup: (group: GroupRef) => void
  /** Starts a team with nobody on it. */
  readonly useNothing: () => void
}

interface MergeInput {
  readonly edits: TeamDraft
  readonly group: GroupRef
  /** The team to top up, or null to build a new one named after the group. */
  readonly into: null | Team
  readonly members: readonly TeamMember[]
}

/** Which of the right-hand pane's three jobs it is doing. */
type Pane =
  /** Choosing a group to merge into the team already chosen. */
  | 'adding'
  | 'editing'
  /** Choosing a group to build a new team from, or starting blank. */
  | 'starting'

/**
 * Which team is being edited, which pane is showing, and the two ways a group
 * becomes people.
 *
 * Both group paths are the same three steps — read the group, fold the people
 * into a team, show that team — and writing them inline twice is where the
 * second one quietly stops matching the first. Which of the two it is comes from
 * the pane that asked, never from whether a team happens to be chosen: a reader
 * starting their second team always has a first one chosen behind the pane.
 *
 * Neither path writes: both change the draft, and only Save reaches the store.
 * A team built from a group is still minted already full, in one change, so
 * there is never a draft holding a team that carries the group's name and none
 * of its people.
 */
export function useManagerState(edits: TeamDraft, seeding: Seeding): ManagerState {
  const [chosenId, setChosenId] = useState<null | string>(null)
  const [pane, setPane] = useState<Pane>('editing')
  const chosen = chosenOf(edits.teams, chosenId)

  function adopt(team: Team) {
    setChosenId(team.id)
    setPane('editing')
  }

  return {
    choose: (id) => {
      setChosenId(id)
      setPane('editing')
    },
    chosen,
    clear: () => {
      setChosenId(null)
      setPane('editing')
    },
    pane,
    show: setPane,
    useGroup: (group) => {
      const into = pane === 'adding' ? chosen : null
      // Taken before the read, checked after it. A group is read a page at a
      // time, and a reader who discards while it is in the air has taken the
      // click back — folding its people in afterwards would rebuild the draft
      // they just threw away.
      const started = edits.started()

      void seeding.read(group.fullPath).then((members) => {
        if (edits.wanted(started)) {
          merge({ edits, group, into, members }, adopt)
        }
      })
    },
    useNothing: () => {
      const blank = newTeam(crypto.randomUUID(), m.teams_new_name(), nowInstant())

      adopt(blank)
      edits.apply((teams) => withTeam(teams, blank))
    },
  }
}

/**
 * The chosen team, or the first one, or none when the reader keeps none.
 *
 * Falling back to the first rather than to nothing: a team deleted while chosen
 * leaves an identifier naming nothing, and an empty pane beside a list of teams
 * is a surface that looks broken.
 */
function chosenOf(teams: readonly Team[], chosenId: null | string): null | Team {
  if (chosenId === null) {
    return teams[0] ?? null
  }

  return teams.find((team) => team.id === chosenId) ?? teams[0] ?? null
}

/**
 * The group's people, folded into the team the reader was topping up or into a
 * new one named after the group.
 *
 * Merging never removes. A team asked for more people from a group is a team the
 * reader is topping up, and reconciling both ways would take off the colleague
 * they added by hand — which is the half of "a suggestion is not a subscription"
 * a refresh is most likely to break.
 *
 * The new team keeps the group's *name* and no reference to it. A stored path is
 * a second thing that can go stale — a group renamed, moved, or closed to this
 * reader — and it would invite exactly the resubscription the rule forbids.
 */
function merge({ edits, group, into, members }: MergeInput, adopt: (team: Team) => void) {
  const at = nowInstant()

  if (into === null) {
    const built = withMembers(newTeam(crypto.randomUUID(), group.name, at), members, at)

    adopt(built)
    edits.apply((teams) => withTeam(teams, built))

    return
  }

  const grown = withMembers(into, members, at)

  adopt(grown)
  edits.apply((teams) => withUpdated(teams, grown))
}
