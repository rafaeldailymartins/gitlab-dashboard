import { useMemo, useState } from 'react'

import type { Team } from '@/entities/teams'

import { usePreferences } from '@/entities/preferences'
import { withTeam } from '@/entities/teams'
import { m } from '@/shared/i18n'
import { Skeleton } from '@/shared/ui/skeleton'

import { teamActions } from '../lib/team-actions'
import { useSuggestions } from '../lib/use-suggestions'
import { useTeamEdits } from '../lib/use-team-edits'
import { SaveNotice } from './save-notice'
import { TeamEditor } from './team-editor'
import { TeamList } from './team-list'

/**
 * The teams a reader keeps, and everything they can do to one.
 *
 * A screen rather than a dialog on the report. The accessibility and narrow-width
 * sweeps address every screen by URL, there is no dialog primitive in
 * `shared/ui`, and `/settings` is the precedent — a place where the app's own
 * state is edited, reachable by link and by address.
 *
 * It is not in the navigation. "Equipes" beside "Equipe" at 375 px is worse than
 * one more click, so it is reached from the report and from settings.
 *
 * Which team is being edited is component state rather than an address, because
 * nothing here is worth sending somebody else: these are this reader's own
 * teams, private to them.
 */
export function TeamsPage() {
  const { preferences } = usePreferences()
  const edits = useTeamEdits()
  const [chosenId, setChosenId] = useState<null | string>(null)
  const [seedGroup, setSeedGroup] = useState('')
  const team = chosenOf(edits.teams, chosenId)
  const suggestions = useSuggestions(seedGroup, preferences.timeZone)
  const already = useMemo(() => new Set((team?.members ?? []).map((one) => one.id)), [team])

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{m.teams_heading()}</h1>
        <p className="text-sm text-muted-foreground">{m.teams_description()}</p>
      </header>

      <SaveNotice state={edits.state} />

      {edits.loading ? <Skeleton className="h-64 w-full" /> : null}

      {edits.loading ? null : (
        <TeamList
          chosen={team}
          onChoose={setChosenId}
          onCreate={(created) => {
            setChosenId(created.id)
            edits.apply((teams) => withTeam(teams, created))
          }}
          teams={edits.teams}
        />
      )}

      {edits.loading || team === null ? null : (
        <TeamEditor
          {...teamActions(edits, team, setChosenId)}
          already={already}
          key={team.id}
          onSeed={setSeedGroup}
          seedGroup={seedGroup}
          suggestions={suggestions}
          team={team}
        />
      )}

      {edits.loading || edits.teams.length > 0 ? null : (
        <p className="text-sm text-muted-foreground">{m.teams_none_yet()}</p>
      )}
    </main>
  )
}

/**
 * The chosen team, or the first one, or none when the reader keeps none.
 *
 * Falling back to the first rather than to nothing: a team deleted while chosen
 * leaves an identifier naming nothing, and an empty editor beside a list of
 * teams is a screen that looks broken.
 */
function chosenOf(teams: readonly Team[], chosenId: null | string): null | Team {
  if (chosenId === null) {
    return teams[0] ?? null
  }

  return teams.find((team) => team.id === chosenId) ?? teams[0] ?? null
}
