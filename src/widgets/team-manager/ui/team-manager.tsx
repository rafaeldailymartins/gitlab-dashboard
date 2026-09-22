import type { ReactNode } from 'react'

import { Skeleton } from '@/shared/ui/skeleton'

import { useGroupSeeding } from '../lib/use-group-seeding'
import { useManagerState } from '../lib/use-manager-state'
import { useSavedFailure } from '../lib/use-saved-failure'
import { useTeamEdits } from '../lib/use-team-edits'
import { ManagerPane } from './manager-pane'
import { SaveNotice } from './save-notice'
import { TeamRail } from './team-rail'

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
export function TeamManager() {
  const edits = useTeamEdits()
  const seeding = useGroupSeeding()
  const state = useManagerState(edits, seeding)
  const unreachable = useSavedFailure(edits)

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
