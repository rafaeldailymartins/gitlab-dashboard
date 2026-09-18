import { describe, expect, it } from 'vitest'

import { memoryStorage } from '@/shared/lib/storage'

import { sessionStore } from './session-store'

const NOW = Date.UTC(2026, 7, 21, 12, 0, 0)
const HOUR = 3_600_000
const MINUTE = 60_000

/** A token shaped like GitLab's: only its `exp` is ever read. */
function idToken(expiresAt: number): string {
  const claims = JSON.stringify({ exp: Math.floor(expiresAt / 1000), sub: '42' })
  const payload = btoa(claims).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')

  return `header.${payload}.signature`
}

const ID_TOKEN = idToken(NOW + 2 * MINUTE)

const SESSION = {
  accessToken: 'access-1',
  expiresInSeconds: 7200,
  idToken: ID_TOKEN,
  refreshToken: 'refresh-1',
}

describe('sessionStore', () => {
  it('holds nothing before a session exists', () => {
    const store = sessionStore(memoryStorage())

    expect(store.readCredential()).toBeNull()
    expect(store.readIdentity()).toBeNull()
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

  it('never writes the identity assertion to storage either', () => {
    const storage = memoryStorage()
    const store = sessionStore(storage)

    store.write(SESSION, NOW)

    expect(store.readIdentity()?.idToken).toBe(ID_TOKEN)
    expect(JSON.stringify(storage)).not.toContain(ID_TOKEN)
  })

  it('dates the identity from the token rather than from the session', () => {
    const store = sessionStore(memoryStorage())

    store.write(SESSION, NOW)

    // `expiresInSeconds` describes the access token, two hours out. The
    // assertion's own `exp` is two minutes out, and that is what must be read.
    expect(store.readIdentity()?.expiresAt).toBe(NOW + 2 * MINUTE)
  })

  it('holds no identity when the grant carried none', () => {
    const store = sessionStore(memoryStorage())

    store.write({ ...SESSION, idToken: null }, NOW)

    expect(store.readIdentity()).toBeNull()
    expect(store.readCredential()).not.toBeNull()
  })

  it('drops a held identity when a later grant carries none', () => {
    const store = sessionStore(memoryStorage())

    store.write(SESSION, NOW)
    store.write({ ...SESSION, idToken: null }, NOW + HOUR)

    // Keeping the old one would let a session that lost the scope go on
    // presenting an assertion GitLab has stopped granting it.
    expect(store.readIdentity()).toBeNull()
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
    expect(store.readIdentity()).toBeNull()
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
