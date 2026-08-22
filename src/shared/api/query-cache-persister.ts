import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

import { clear, createStore, get, set } from 'idb-keyval'

/**
 * IndexedDB rather than `localStorage`: the writes are asynchronous, so
 * persisting a report never blocks the paint it is meant to make faster, and a
 * few hundred kilobytes of history is nowhere near a limit.
 *
 * The cache is written through the structured clone algorithm rather than
 * through JSON, which is what lets a `Date` come back as a `Date`. A JSON round
 * trip would restore every `spentAt` as a string and every hour figure derived
 * from it would be wrong in a way nothing would announce.
 */
const DATABASE = 'gitlab-dashboard'
const STORE = 'query-cache'
const KEY = 'client'

/** Trailing edge only: a burst of cache updates costs one write. */
const WRITE_INTERVAL = 1000

/** Where a persisted cache is kept. Injected so a test needs no database. */
export interface CacheStorage {
  clear(): Promise<void>
  read(): Promise<PersistedClient | undefined>
  write(client: PersistedClient): Promise<void>
}

interface Throttled<T> {
  (value: T): void
  cancel(): void
}

export function queryCachePersister(
  storage: CacheStorage = indexedDbCacheStorage(),
  interval: number = WRITE_INTERVAL,
): Persister {
  const write = throttle((client: PersistedClient) => storage.write(client), interval)

  return {
    persistClient(client) {
      write(client)
    },
    async removeClient() {
      write.cancel()

      try {
        // Signing out forgets everything, so one reader's hours never greet the
        // next one on a shared device.
        await storage.clear()
      } catch {
        // A browser that refuses to be cleared holds nothing this app can act
        // on, and the reader is already signed out.
      }
    },
    async restoreClient() {
      try {
        return await storage.read()
      } catch {
        // No cache is a slower first paint, not a failure worth reporting.
        return
      }
    },
  }
}

async function ignoreFailure(work: Promise<void>): Promise<void> {
  try {
    await work
  } catch {
    // See `throttle`: a refused write costs a slower first paint, nothing more.
  }
}

function indexedDbCacheStorage(): CacheStorage {
  const store = createStore(DATABASE, STORE)

  return {
    clear: () => clear(store),
    read: () => get<PersistedClient>(KEY, store),
    write: (client) => set(KEY, client, store),
  }
}

/**
 * Keeps the newest value and writes it once the interval has passed.
 *
 * A failed write is swallowed: a browser can deny storage — private mode, a
 * full disk — and the cache is an optimisation. Losing it must not surface as an
 * unhandled rejection in front of the reader.
 */
function throttle<T>(operation: (value: T) => Promise<void>, interval: number): Throttled<T> {
  let timer: null | ReturnType<typeof setTimeout> = null
  let pending: null | { value: T } = null

  const run = (): void => {
    timer = null
    const next = pending
    pending = null

    if (next) {
      void ignoreFailure(operation(next.value))
    }
  }

  const throttled = (value: T): void => {
    pending = { value }
    timer ??= setTimeout(run, interval)
  }

  throttled.cancel = (): void => {
    pending = null

    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return throttled
}
