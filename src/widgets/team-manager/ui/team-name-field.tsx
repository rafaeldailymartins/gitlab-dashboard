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
 * It used to be the one control here that was **not** committed on every
 * keystroke, because a save per letter was twenty conditional writes racing
 * each other over one rename. Edits are collected now and written once, so that
 * objection is gone — and what replaced it was worse: a Save pressed while this
 * field still held uncommitted text dropped the rename without saying anything.
 * Every letter goes into the draft, and only the save reaches the store.
 *
 * A name the store would refuse is refused here and says so, rather than being
 * sent and coming back as a failure the reader cannot connect to what they
 * typed. The typed text is kept either way, so nothing they wrote disappears
 * while they are fixing it.
 *
 * The **trimmed** name is what goes into the draft while the untrimmed text
 * stays in the field, so that typing a space after a word does not have it
 * taken away again under the cursor.
 *
 * The caller keys this on the team's identifier, so choosing another team
 * remounts the field with that team's name. That is not enough on its own any
 * more: discarding a draft reverts the name without changing which team is
 * chosen, so the field would sit there showing a rename that no longer exists.
 * It follows the team during render, exactly as `WeekdayTargetInput` follows a
 * target the store moved, and for the same reason — an effect would overwrite
 * what the reader is in the middle of typing.
 */
export function TeamNameField({ onRename, team }: TeamNameFieldProps) {
  const errorId = useId()
  const [draft, setDraft] = useState(team.name)
  const [committed, setCommitted] = useState(team.name)
  const valid = isValidTeamName(draft)

  if (team.name !== committed) {
    setCommitted(team.name)
    setDraft(team.name)
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <input
        aria-describedby={valid ? undefined : errorId}
        aria-invalid={!valid}
        aria-label={m.teams_name_label()}
        className={cn(FIELD)}
        maxLength={MAX_NAME_LENGTH}
        onChange={(event) => {
          commit(event.target.value)
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

  function commit(typed: string) {
    setDraft(typed)

    const named = typed.trim()

    if (isValidTeamName(typed) && named !== team.name) {
      // Remembered as the trimmed name, which is what the team will carry, so
      // the render-time follow above does not read this back as somebody else
      // having renamed the team under the reader.
      setCommitted(named)
      onRename(named)
    }
  }
}
