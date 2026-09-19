import type { Page } from '@playwright/test'

/**
 * The reader's own history, as the persisted cache names it.
 *
 * Never a claim of its own — the anchor for the ones made around it. Every rule
 * about what this app keeps is a rule about an absence, and an absence read off
 * a store nothing was ever written to is free: a colleague's name is missing
 * from an empty string, from a browser that refused to persist at all, and from
 * a probe that quietly failed. So a scenario states what it expects to find
 * first, and reads its absences against that having been found.
 */
export const PERSONAL_HISTORY = '["timelogs","mine"]'

/**
 * Everything this device kept, as one string to look a name up in.
 *
 * Both web storages and every IndexedDB database, contents and all — the query
 * cache is the one place a roster or an hour could be left without anybody
 * writing it there on purpose, and reading only the database names would not see
 * it.
 *
 * It lives here rather than in a step file because two different rules are
 * measured with it: GROUP-18 about somebody else's hours and names, TEAM-2 about
 * a roster. A second probe that disagreed with this one about what "the device"
 * means would be worse than either of them, because the one that looked in fewer
 * places would be the one that passed.
 */
export async function deviceContents(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const kept: string[] = [JSON.stringify(localStorage), JSON.stringify(sessionStorage)]

    for (const { name } of await indexedDB.databases()) {
      const database = await new Promise<IDBDatabase>((resolve) => {
        const opening = indexedDB.open(name ?? '')

        opening.onsuccess = () => {
          resolve(opening.result)
        }
      })
      const stores = [...database.objectStoreNames]

      if (stores.length > 0) {
        const reading = database.transaction(stores, 'readonly')
        const rows: IDBRequest<unknown[]>[] = stores.map((store) =>
          reading.objectStore(store).getAll(),
        )

        await new Promise((done) => {
          reading.oncomplete = done
        })
        kept.push(JSON.stringify(rows.map((row) => row.result)))
      }
    }

    return kept.join('|')
  })
}
