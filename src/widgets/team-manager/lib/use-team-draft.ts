import { useRef, useState } from 'react'

import type { Team, TeamsFailure } from '@/entities/teams'

import type { SaveState, TeamsChange } from './use-team-edits'

import { useTeamEdits } from './use-team-edits'

export interface TeamDraft {
  /** Changes what is being edited. Nothing is stored until `save`. */
  readonly apply: (change: TeamsChange) => void
  /** True once anything has been edited and not yet stored. */
  readonly dirty: boolean
  /** Throws the edits away, leaving the stored list. */
  readonly discard: () => void
  /** Why the store would not say what teams this reader has, or null. */
  readonly failure: null | TeamsFailure
  readonly loading: boolean
  readonly save: () => void
  /**
   * A token for work started now, to be handed back to `wanted` when it lands.
   *
   * Reading a group takes up to four sequential pages, and the answer folds
   * people into whatever is being edited. Nothing stops the reader discarding
   * while it is in the air — and a merge landing afterwards would rebuild the
   * draft they just threw away, out of a click they had already taken back.
   */
  readonly started: () => number
  readonly state: SaveState
  /** What is being edited, or the stored list when nothing has been. */
  readonly teams: readonly Team[]
  /** Whether work begun at `token` is still wanted, or was thrown away since. */
  readonly wanted: (token: number) => boolean
}

/**
 * Every edit, collected, and written once when the reader saves them.
 *
 * This reverses what `use-team-edits.ts` argues for, and the argument it
 * reverses is worth reading before reversing it back: a list built by clicking
 * names would lose those clicks to a closed tab, and "unsaved" is an awkward
 * thing to explain on a surface whose whole job is a list. Both halves are
 * still true, and neither outweighed what save-on-edit cost — removing a
 * colleague was final the moment it was clicked, with no way back but to find
 * them again by name.
 *
 * It also removes a defect that had nothing to do with taste. `apply` built
 * every write from the list as it was last read and carried the version read
 * with it, with no mutation scope, so two edits in quick succession were both
 * built on the list before either. Measured against a store that holds writes
 * open: removing two people from a team of three sent `etags = ["1","1"]` and
 * `sizes = [2,2]` — the second write reverting the first, and against the real
 * endpoint refused with a 409 whose notice blamed the reader's own two clicks
 * on somebody else. One write from one snapshot cannot do that.
 *
 * A separate module rather than more of `use-team-edits.ts`: that hook is
 * already a query, a mutation and a return, and draft, dirty, save and discard
 * put it past `max-statements`. The split is also the honest shape — one of
 * these owns the store, the other owns what has not reached it.
 *
 * **The draft is state and nothing else.** Not the query cache, which the report
 * behind this dialog reads — a draft there would repaint the month under a
 * reader and make discarding it a problem of putting the report back. And not
 * the device: TEAM-2 forbids a roster reaching storage, and the acceptance
 * suite reads `localStorage`, `sessionStorage` and every IndexedDB store by
 * content looking for exactly that. Closing the dialog drops the draft, which
 * is the behaviour rather than a gap in it.
 */
export function useTeamDraft(onSaved?: (teams: readonly Team[]) => void): TeamDraft {
  const [draft, setDraft] = useState<null | readonly Team[]>(null)
  // A ref rather than state: it is read by work that started in an earlier
  // render, so the value that matters is the one now rather than the one that
  // render closed over.
  const era = useRef(0)
  const edits = useTeamEdits({
    // The one refusal that takes the edits away. Everything else leaves them on
    // screen to try again — a store that could not be reached changed nothing,
    // so what the reader edited is still true. A conflict is not that: the list
    // moved under them, and TEAM-5 is that they see whose it is now.
    onConflict: () => {
      era.current += 1
      setDraft(null)
    },
    // Cleared on success here rather than in `save`, so a write that never
    // arrived leaves the edits alone.
    onSaved: (written) => {
      era.current += 1
      setDraft(null)
      onSaved?.(written)
    },
  })

  return {
    apply: (change) => {
      setDraft((held) => change(held ?? edits.teams))
    },
    dirty: draft !== null,
    discard: () => {
      era.current += 1
      setDraft(null)
    },
    failure: edits.failure,
    loading: edits.loading,
    save: () => {
      if (draft !== null) {
        edits.apply(() => draft)
      }
    },
    started: () => era.current,
    state: edits.state,
    teams: draft ?? edits.teams,
    wanted: (token) => token === era.current,
  }
}
