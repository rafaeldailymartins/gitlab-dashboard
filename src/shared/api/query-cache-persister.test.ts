import type { PersistedClient } from '@tanstack/react-query-persist-client'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type CacheStorage, queryCachePersister } from './query-cache-persister'

const INTERVAL = 1000

function memoryStorage() {
  let held: PersistedClient | undefined

  return {
    clear: vi.fn(() => {
      held = undefined

      return Promise.resolve()
    }),
    read: vi.fn(() => Promise.resolve(held)),
    write: vi.fn((client: PersistedClient) => {
      held = client

      return Promise.resolve()
    }),
  } satisfies CacheStorage
}

function persistedClient(timestamp: number): PersistedClient {
  return { buster: '', clientState: { mutations: [], queries: [] }, timestamp }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('queryCachePersister', () => {
  it('writes the cache once the interval has passed', async () => {
    const storage = memoryStorage()

    queryCachePersister(storage, INTERVAL).persistClient(persistedClient(1))

    expect(storage.write).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(storage.write).toHaveBeenCalledTimes(1)
  })

  it('costs one write for a burst of updates, and keeps the newest', async () => {
    const storage = memoryStorage()
    const persister = queryCachePersister(storage, INTERVAL)

    persister.persistClient(persistedClient(1))
    persister.persistClient(persistedClient(2))
    persister.persistClient(persistedClient(3))
    await vi.advanceTimersByTimeAsync(INTERVAL)

    expect(storage.write).toHaveBeenCalledTimes(1)
    expect(storage.write).toHaveBeenCalledWith(persistedClient(3))
  })

  it('writes again after the interval, rather than only once ever', async () => {
    const storage = memoryStorage()
    const persister = queryCachePersister(storage, INTERVAL)

    persister.persistClient(persistedClient(1))
    await vi.advanceTimersByTimeAsync(INTERVAL)
    persister.persistClient(persistedClient(2))
    await vi.advanceTimersByTimeAsync(INTERVAL)

    expect(storage.write).toHaveBeenCalledTimes(2)
  })

  it('restores what was written', async () => {
    const storage = memoryStorage()
    const persister = queryCachePersister(storage, INTERVAL)

    persister.persistClient(persistedClient(7))
    await vi.advanceTimersByTimeAsync(INTERVAL)

    await expect(persister.restoreClient()).resolves.toEqual(persistedClient(7))
  })

  it('restores nothing when nothing was ever written', async () => {
    const persister = queryCachePersister(memoryStorage(), INTERVAL)

    await expect(persister.restoreClient()).resolves.toBeUndefined()
  })

  it('forgets everything when the cache is removed', async () => {
    const storage = memoryStorage()
    const persister = queryCachePersister(storage, INTERVAL)

    persister.persistClient(persistedClient(1))
    await vi.advanceTimersByTimeAsync(INTERVAL)
    await persister.removeClient()

    await expect(persister.restoreClient()).resolves.toBeUndefined()
  })

  it('drops a write that was still pending when the cache was removed', async () => {
    const storage = memoryStorage()
    const persister = queryCachePersister(storage, INTERVAL)

    persister.persistClient(persistedClient(1))
    await persister.removeClient()
    await vi.advanceTimersByTimeAsync(INTERVAL)

    expect(storage.write).not.toHaveBeenCalled()
  })

  it('survives a browser that refuses to store anything', async () => {
    const storage = {
      ...memoryStorage(),
      write: vi.fn(() => Promise.reject(new Error('QuotaExceededError'))),
    }
    const persister = queryCachePersister(storage, INTERVAL)

    persister.persistClient(persistedClient(1))
    await vi.advanceTimersByTimeAsync(INTERVAL)

    // Vitest fails a test on an unhandled rejection, so reaching this line is
    // the assertion: the refused write was swallowed.
    expect(storage.write).toHaveBeenCalledTimes(1)
  })

  it('survives a browser that refuses to be read', async () => {
    const storage = {
      ...memoryStorage(),
      read: vi.fn(() => Promise.reject(new Error('SecurityError'))),
    }

    await expect(queryCachePersister(storage, INTERVAL).restoreClient()).resolves.toBeUndefined()
  })

  it('survives a browser that refuses to be cleared', async () => {
    const storage = {
      ...memoryStorage(),
      clear: vi.fn(() => Promise.reject(new Error('SecurityError'))),
    }

    await expect(queryCachePersister(storage, INTERVAL).removeClient()).resolves.toBeUndefined()
  })
})
