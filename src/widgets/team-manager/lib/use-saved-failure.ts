import { m } from '@/shared/i18n'

import type { TeamEdits } from './use-team-edits'

/**
 * Why the store would not answer, in the reader's language, or null.
 *
 * Two sentences rather than one, because the two failures ask different things
 * of a reader. A store that cannot be reached is an outage, and waiting is the
 * whole of the answer. A session granted before this app asked for an identity
 * is not broken at all — everything else it authorises still works, and
 * authorising once more repairs it. Telling that reader the store is down would
 * send them waiting for something that will never change on its own.
 *
 * Neither ever signs the reader out. Discarding a working session because a
 * secondary screen wants something else loses them their place for no gain.
 */
export function useSavedFailure(edits: TeamEdits): null | string {
  if (edits.failure === null) {
    return null
  }

  return edits.failure.kind === 'identity-unavailable' ? m.teams_reconnect() : m.teams_unavailable()
}
