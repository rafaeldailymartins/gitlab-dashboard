import { describe, expect, it } from 'vitest'

import { memoryStorage } from '@/shared/lib/storage'

import { sessionStore } from './session-store'

const NOW = Date.UTC(2026, 7, 21, 12, 0, 0)
const HOUR = 3_600_000

const SESSION = { accessToken: 'access-1', expiresInSeconds: 7200, refreshToken: 'refresh-1' }

describe('sessionStore', () => {
  it('holds nothing before a session exists', () => {
    const store = sessionStore(memoryStorage())

    expect(store.readCredential()).toBeNull()
    expect(store.readRefreshToken()).toBeNull()
  })

  it('turns a session into a credential with an absolute expiry', () => {
    const store = sessionStore(memoryStorage())

    const credential = store.write(SESSION, NOW)

    expect(credential).toEqual({ accessToken: 'access-1', expiresAt: NOW + 2 * HOUR })
    expect(store.readCredential()).toEqual(credential)
  })

  it('never writes the access token to storage', () => {
    const storage = memoryStorage()
    const store = sessionStore(storage)

    store.write(SESSION, NOW)

    // Only the refresh token may persist; the access token dies with the tab.
    expect(storage.read('gitlab.refreshToken')).toBe('refresh-1')
    expect(JSON.stringify(storage)).not.toContain('access-1')
  })

  it('replaces the refresh token on every write, matching GitLab rotating it', () => {
    const storage = memoryStorage()
    const store = sessionStore(storage)

    store.write(SESSION, NOW)
    store.write({ ...SESSION, accessToken: 'access-2', refreshToken: 'refresh-2' }, NOW + HOUR)

    expect(storage.read('gitlab.refreshToken')).toBe('refresh-2')
    expect(store.readCredential()?.accessToken).toBe('access-2')
  })

  it('leaves nothing behind when cleared', () => {
    const storage = memoryStorage()
    const store = sessionStore(storage)

    store.write(SESSION, NOW)
    store.clear()

    expect(store.readCredential()).toBeNull()
    expect(store.readRefreshToken()).toBeNull()
    expect(storage.read('gitlab.refreshToken')).toBeNull()
  })

  it('keeps two stores independent, so one reader is never shown another session', () => {
    const first = sessionStore(memoryStorage())
    const second = sessionStore(memoryStorage())

    first.write(SESSION, NOW)

    expect(second.readCredential()).toBeNull()
  })
})
