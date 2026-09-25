import { type ReactNode, useEffect } from 'react'

import type { Team } from '@/entities/teams'

import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

import { useGroupSeeding } from '../lib/use-group-seeding'
import { useManagerState } from '../lib/use-manager-state'
import { useSavedFailure } from '../lib/use-saved-failure'
import { useTeamDraft } from '../lib/use-team-draft'
import { ManagerPane } from './manager-pane'
import { SaveNotice } from './save-notice'
import { TeamRail } from './team-rail'

interface TeamManagerProps {
  /**
   * Whether anything has been edited and not yet stored.
   *
   * Reported upward because the thing that closes this surface is the dialog
   * around it, and a surface that can lose work should not be closed by
   * something that cannot tell whether there is any.
   */
  readonly onDirtyChange?: ((dirty: boolean) => void) | undefined
  /**
   * What was stored, once it has been — so a caller whose screen is about one
   * of these teams can follow a list this surface changed.
   */
  readonly onSaved?: ((teams: readonly Team[]) => void) | undefined
}

/**
 * The teams a reader keeps, and everything they can do to one.
 *
 * A rail of teams beside one pane, which is the shape the content always had and
 * the old screen did not use: three stacked sections of form controls made the
 * list of teams read as the first question of a form rather than as the thing
 * every other control on it was about.
 *
 * A store that refused is answered before anything else. It is not a reader with
 * no teams, and inviting somebody to build one they may already have is the
 * worst thing this surface can say.
 */
export function TeamManager({ onDirtyChange, onSaved }: TeamManagerProps) {
  const edits = useTeamDraft(onSaved)
  const seeding = useGroupSeeding()
  const state = useManagerState(edits, seeding)
  const unreachable = useSavedFailure(edits)
  const { dirty } = edits

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  if (edits.loading) {
    return <Skeleton className="m-5 h-72" />
  }

  if (unreachable !== null) {
    return <Notice>{unreachable}</Notice>
  }

  return (
    <>
      <div className="flex min-h-72 flex-1 flex-col sm:flex-row">
        <TeamRail
          chosen={state.chosen}
          onChoose={state.choose}
          onStart={() => {
            state.show('starting')
          }}
          teams={edits.teams}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <ManagerPane edits={edits} seeding={seeding} state={state} />
        </div>
      </div>
      {/* Always in the document, empty when there is nothing to say: a live
          region added at the moment it has something to announce is one
          assistive technology has not been watching. It is a status bar rather
          than a panel for the same reason — most of the time it says nothing,
          and a bordered strip of empty card reads as something that failed to
          load. */}
      <footer className="flex flex-wrap items-center gap-x-3 border-t border-border bg-muted/40 px-5 py-1.5">
        <SaveNotice state={edits.state} />
        {/* Not a live region. `SaveNotice` is this surface's only one, and the
            acceptance suite reads it with an unscoped status locator that
            resolves to a single element only because the dialog hides the
            report's own. A second one makes three steps ambiguous — and the
            reader typing is not something that needs announcing to them. */}
        {dirty ? <span className="text-xs text-muted-foreground">{m.teams_unsaved()}</span> : null}
        <div className="ms-auto flex items-center gap-2 py-1">
          <Button disabled={!dirty} onClick={edits.discard} size="sm" type="button" variant="ghost">
            {m.teams_discard()}
          </Button>
          <Button disabled={!dirty} onClick={edits.save} size="sm" type="button">
            {m.teams_save()}
          </Button>
        </div>
      </footer>
    </>
  )
}

function Notice({ children }: { readonly children: ReactNode }) {
  return (
    <p className="m-5 rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}
