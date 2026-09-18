import { useId } from 'react'

import type { Team } from '@/entities/teams'

import { MAX_TEAMS, newTeam } from '@/entities/teams'
import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'

import { nowInstant } from '../lib/team-actions'
import { TeamTabs } from './team-tabs'

interface TeamListProps {
  readonly chosen: null | Team
  readonly onChoose: (id: string) => void
  readonly onCreate: (team: Team) => void
  readonly teams: readonly Team[]
}

/**
 * Which team is being edited, and the way to start another.
 *
 * The new team is minted here rather than in the store, because the identifier
 * is this app's own and the screen is where a reader decides a team exists. It
 * is a v4 UUID from the platform: nothing about it is derived from the reader or
 * from the name, so nothing about it is guessable or meaningful.
 *
 * Adding is refused at the ceiling rather than left to fail on the save, so a
 * reader learns the limit before spending a round trip on it.
 */
export function TeamList({ chosen, onChoose, onCreate, teams }: TeamListProps) {
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 className="sr-only" id={headingId}>
        {m.teams_list_heading()}
      </h2>
      <TeamTabs chosen={chosen} onChoose={onChoose} teams={teams} />
      <Button
        className="self-start"
        disabled={teams.length >= MAX_TEAMS}
        onClick={() => {
          onCreate(newTeam(crypto.randomUUID(), m.teams_new_name(), nowInstant()))
        }}
        type="button"
        variant="outline"
      >
        {m.teams_add_team()}
      </Button>
    </section>
  )
}
