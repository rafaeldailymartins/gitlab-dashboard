import { m } from '@/shared/i18n'

import type { SaveState } from '../lib/use-team-edits'

/**
 * What the last save did.
 *
 * A live region, and deliberately a polite one that does not move focus: the
 * reader who pressed Save is still on this surface, and a notice that took the
 * cursor away to say the save was refused would leave them hunting for the
 * edits it is about.
 *
 * It is always in the document, empty when there is nothing to say. A live
 * region added to the page at the moment it has something to announce is a
 * region assistive technology has not been watching, and the announcement is
 * lost.
 */
export function SaveNotice({ state }: { readonly state: SaveState }) {
  return (
    <p aria-live="polite" className="min-h-5 text-xs text-muted-foreground" role="status">
      {SENTENCE[state.kind]()}
    </p>
  )
}

const SENTENCE: Record<SaveState['kind'], () => string> = {
  'changed-elsewhere': () => m.teams_changed_elsewhere(),
  failed: () => m.teams_save_failed(),
  idle: () => '',
  saving: () => m.teams_saving(),
}
