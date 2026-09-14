import type { KeyValueStorage } from '@/shared/lib/storage'

/** Where the last group is kept. Namespaced so it cannot collide with a setting. */
const STORAGE_KEY = 'team-report-group'

/**
 * The last group this reader looked at.
 *
 * Only the path, never a figure. `queries.ts` marks every answer on this screen
 * `persist: false` because a group's hours belong to other people and a shared
 * machine must not keep them; a path is not an hour, and without it the reader
 * picks their own team out of a list on every visit.
 */
export function rememberedGroup(storage: KeyValueStorage): string {
  return storage.read(STORAGE_KEY) ?? ''
}

/** Keeps the group for the next visit. A blank one forgets it. */
export function rememberGroup(storage: KeyValueStorage, group: string): void {
  if (group === '') {
    storage.remove(STORAGE_KEY)

    return
  }

  storage.write(STORAGE_KEY, group)
}
