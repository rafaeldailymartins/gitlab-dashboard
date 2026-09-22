import { useMemo } from 'react'

import type { IsoDate } from '@/shared/lib/date'

import { m } from '@/shared/i18n'

import type { ManagerState } from '../lib/use-manager-state'
import type { TeamEdits } from '../lib/use-team-edits'

import { teamActions } from '../lib/team-actions'
import { GroupList } from './group-list'
import { PaneHeading } from './pane-heading'
import { TeamEditor } from './team-editor'
import { TeamStarter } from './team-starter'

interface ManagerPaneProps {
  readonly edits: TeamEdits
  readonly seeding: { readonly busy: null | string; readonly since: IsoDate }
  readonly state: ManagerState
}

/**
 * What the right-hand side is doing: starting a team, topping one up from a
 * group, or editing one.
 *
 * Three arms rather than a chain of conditions inside the markup. A reader with
 * no teams is not a fourth state — starting one is the only thing they can do,
 * so the pane opens on it rather than telling them their list is empty and
 * leaving them to find the button that fixes it. That reader gets no way back
 * either, because there is nothing behind it.
 */
export function ManagerPane({ edits, seeding, state }: ManagerPaneProps) {
  const { chosen } = state
  const already = useMemo(
    () => new Set((chosen?.members ?? []).map((one) => one.id)),
    [chosen?.members],
  )
  const back = () => {
    state.show('editing')
  }

  if (state.pane === 'adding' && chosen !== null) {
    return (
      <section className="flex min-h-0 flex-col gap-3 p-5">
        <PaneHeading onBack={back} title={m.teams_add_from_group_heading({ team: chosen.name })} />
        <GroupList
          busy={seeding.busy}
          label={m.teams_group_search_label()}
          onChoose={state.useGroup}
        />
      </section>
    )
  }

  if (state.pane === 'starting' || chosen === null) {
    return (
      <TeamStarter
        busy={seeding.busy}
        onBack={edits.teams.length === 0 ? null : back}
        onBlank={state.useNothing}
        onGroup={state.useGroup}
        since={seeding.since}
      />
    )
  }

  return (
    <TeamEditor
      {...teamActions(edits, chosen, state.clear)}
      already={already}
      key={chosen.id}
      onAddFromGroup={() => {
        state.show('adding')
      }}
      team={chosen}
    />
  )
}
