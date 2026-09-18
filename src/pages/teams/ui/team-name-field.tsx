import { useId, useState } from 'react'

import type { Team } from '@/entities/teams'

import { isValidTeamName, MAX_NAME_LENGTH } from '@/entities/teams'
import { m } from '@/shared/i18n'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

interface TeamNameFieldProps {
  readonly onRename: (name: string) => void
  readonly team: Team
}

/**
 * The team's name.
 *
 * The one control on this screen that is **not** saved on every keystroke: a
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
  const fieldId = useId()
  const errorId = `${fieldId}-error`
  const [draft, setDraft] = useState(team.name)
  const valid = isValidTeamName(draft)

  return (
    <div className="flex max-w-sm flex-col gap-1.5">
      <Label htmlFor={fieldId}>{m.teams_name_label()}</Label>
      <Input
        aria-describedby={valid ? undefined : errorId}
        aria-invalid={!valid}
        id={fieldId}
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
