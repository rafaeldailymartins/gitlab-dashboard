import { useState } from 'react'

import type { Team } from '@/entities/teams'

import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'

import { TeamManager } from './team-manager'

interface LeaveQuestionProps {
  readonly onDiscard: () => void
  readonly onKeep: () => void
}

interface TeamManagerDialogProps {
  /**
   * Asked to open or close.
   *
   * This surface's own statement rather than Base UI's event passed through:
   * three of the four ways out of here are the dialog's own decision — saving,
   * cancelling, and discarding at the question — and none of them has a
   * dismissal event behind it. A caller cannot tell them apart and has no
   * reason to.
   */
  readonly onOpenChange: (open: boolean) => void
  /** What was stored, once it has been. See `TeamManager`. */
  readonly onSaved?: ((teams: readonly Team[]) => void) | undefined
  readonly open: boolean
}

/**
 * The teams a reader keeps, over whatever they were reading.
 *
 * A dialog rather than a screen, which reverses the decision this surface
 * shipped with. That decision was sound about the wrong thing: the accessibility
 * and 375 px sweeps do address screens by URL, and `/settings` is a real
 * precedent for a place the app's own state is edited. But settings are edited
 * once, from anywhere, with nothing on screen depending on them, while a team is
 * edited *because of what the report in front of you shows* — and the report is
 * where you were going anyway. Sending the reader somewhere else to fix the list
 * their figures are about cost them their place and bought nothing: this surface
 * never had an address worth sending anybody, being one reader's private list.
 *
 * The trigger belongs to the caller. The report attaches it to the control that
 * names the team it acts on; settings puts it in a card. A trigger owned here
 * would be one button pretending to suit both.
 *
 * Nothing about which team is being edited lives in the address, for the same
 * reason there is no address at all.
 *
 * **It still does not close itself; it asks.** Edits are collected and written
 * on a save, so dismissing this is the one action that can lose work — and
 * there are three ways to do it: the close control, Escape, and the backdrop.
 * `DialogContent` always renders the first and Base UI owns the other two, so
 * the answer is not to take one away but to route all of them through the same
 * question. Intercepting here rather than at each caller, because there are two
 * of them — the report and a card in settings — and a guard written twice
 * drifts.
 *
 * The question is an inline bar, not a second dialog. A focus trap inside a
 * focus trap is what the keyboard sweep would find and what a reader would
 * feel; one trap and one tab ring is the whole of the reason. Nothing is focused
 * for the reader either: `jsx-a11y/no-autofocus` is an error in this
 * repository, and moving the cursor out from under somebody who pressed Escape
 * is the behaviour that rule exists to stop.
 */
export function TeamManagerDialog({ onOpenChange, onSaved, open }: TeamManagerDialogProps) {
  const [dirty, setDirty] = useState(false)
  const [asking, setAsking] = useState(false)
  const close = () => {
    onOpenChange(false)
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        // Only a dismissal is ever in question. Saving and cancelling close by
        // going through `close` directly, because both say what to do about the
        // edits — asking again would be asking somebody to repeat themselves.
        if (!next && dirty) {
          setAsking(true)

          return
        }

        onOpenChange(next)
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{m.teams_heading()}</DialogTitle>
          <DialogDescription>{m.teams_description()}</DialogDescription>
        </DialogHeader>
        <TeamManager
          onCancel={close}
          onDirtyChange={setDirty}
          onSaved={(teams) => {
            onSaved?.(teams)
            close()
          }}
        />
        {asking ? (
          <LeaveQuestion
            onDiscard={close}
            onKeep={() => {
              setAsking(false)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/**
 * What to do about edits that were not saved.
 *
 * Discarding closes, which drops the draft with the surface — there is nothing
 * to undo because nothing was stored. Keeping leaves the reader exactly where
 * they were, which is the answer the escape key was most likely asking for.
 */
function LeaveQuestion({ onDiscard, onKeep }: LeaveQuestionProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-muted/40 px-5 py-2">
      <p className="text-sm">{m.teams_close_question()}</p>
      <div className="ms-auto flex items-center gap-2">
        <Button onClick={onDiscard} size="sm" type="button" variant="ghost">
          {m.teams_close_anyway()}
        </Button>
        <Button onClick={onKeep} size="sm" type="button">
          {m.teams_close_keep()}
        </Button>
      </div>
    </div>
  )
}
