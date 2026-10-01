import type { KeyValueStorage } from '@/shared/lib/storage'

/** Where the last team is kept. Namespaced so it cannot collide with a setting. */
const STORAGE_KEY = 'team-report-team'

/**
 * The last team this reader looked at.
 *
 * Only this app's own identifier for it — never a name, never a colleague, never
 * a figure. `NOT_PERSISTED` marks every answer on this screen `persist: false`
 * because a team's hours and its people belong to somebody other than the
 * reader, and a shared machine must not keep them; an opaque identifier this app
 * minted is none of those things, and without it the reader picks their own team
 * out of a list on every visit.
 *
 * The group filter is deliberately **not** remembered. A team has no safe
 * default, so remembering it saves a choice the reader has to make anyway; the
 * filter's default is the widest and most honest state, and remembering a
 * narrowing would make every later visit show less than the scope sentence
 * prepares the reader for — silently, in the one direction that understates a
 * colleague's month.
 */
export function rememberedTeam(storage: KeyValueStorage): string {
  return storage.read(STORAGE_KEY) ?? ''
}

/** Keeps the team for the next visit. A blank one forgets it. */
export function rememberTeam(storage: KeyValueStorage, team: string): void {
  if (team === '') {
    storage.remove(STORAGE_KEY)

    return
  }

  storage.write(STORAGE_KEY, team)
}
