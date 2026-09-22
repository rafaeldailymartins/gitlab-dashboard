import { useId, useState } from 'react'

import type { Team } from '@/entities/teams'

import { isValidTeamName, MAX_NAME_LENGTH } from '@/entities/teams'
import { m } from '@/shared/i18n'
import { cn } from '@/shared/lib/utils'

interface TeamNameFieldProps {
  readonly onRename: (name: string) => void
  readonly team: Team
}

const FIELD =
  'w-full rounded-md border border-transparent bg-transparent px-2 py-1 -ml-2 text-lg font-semibold tracking-tight hover:border-input focus:border-input focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-invalid:border-destructive'

/**
 * The team's name, editable where it is read.
 *
 * Drawn as the heading it is rather than as a labelled field under one. The name
 * is the first thing on this pane and the thing every other control refers to;
 * putting "Team name" above a box containing the team's name said it twice and
 * made the pane open on a form. The label is still there for anybody who cannot
 * see that it is a heading, which is what `aria-label` is for.
 *
 * The one control on this surface that is **not** saved on every keystroke: a
 * name is typed a letter at a time, and a save per letter would be twenty
 * conditional writes racing each other over one rename. It commits when the
 * field is left or the reader presses Enter.
 *
 * A name the store would refuse is refused here and says so, rather than being
 * sent and coming back as a failure the reader cannot connect to what they
 * typed. The draft is kept either way, so nothing they wrote disappears.
 *
 * The caller keys this on the team's identifier, so choosing another team
 * remounts the field with that team's name. Resetting the draft from an effect
 * instead would also overwrite what the reader was in the middle of typing
 * whenever somebody else's rename arrived.
 */
export function TeamNameField({ onRename, team }: TeamNameFieldProps) {
  const errorId = useId()
  const [draft, setDraft] = useState(team.name)
  const valid = isValidTeamName(draft)

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <input
        aria-describedby={valid ? undefined : errorId}
        aria-invalid={!valid}
        aria-label={m.teams_name_label()}
        className={cn(FIELD)}
        maxLength={MAX_NAME_LENGTH}
        onBlur={() => {
          commit()
        }}
        onChange={(event) => {
          setDraft(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit()
          }
        }}
        value={draft}
      />
      {valid ? null : (
        <p className="text-xs text-destructive" id={errorId}>
          {m.teams_name_invalid({ max: MAX_NAME_LENGTH })}
        </p>
      )}
    </div>
  )

  function commit() {
    if (valid && draft.trim() !== team.name) {
      onRename(draft.trim())
    }
  }
}
