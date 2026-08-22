import { describe, expect, it, vi } from 'vitest'

import { type KeyValueStorage, memoryStorage } from '@/shared/lib/storage'

import type { AuthorizationChallenge, Session } from '../model/ports'

import { AuthError } from '../model/auth-error'
import { pendingAuthorizationStore } from './pending-authorization'
import { sessionManager, type SessionManager } from './session-manager'
import { sessionStore } from './session-store'

const NOW = Date.UTC(2026, 7, 21, 12, 0, 0)
const HOUR = 3_600_000

const PENDING_KEY = 'gitlab.pendingAuthorization'
const REFRESH_KEY = 'gitlab.refreshToken'

interface Harness {
  readonly gateway: ReturnType<typeof gatewayMock>
  readonly manager: SessionManager
  setNow: (at: number) => void
  readonly storage: KeyValueStorage
}

/**
 * A gateway whose shape satisfies the port, so the manager takes it without a
 * cast and a test can still change what any single call returns.
 */
function gatewayMock() {
  return {
    authorizeUrl: vi.fn(
      (_challenge: AuthorizationChallenge) => 'https://gitlab.example/oauth/authorize?state=s',
    ),
    exchangeCode: vi.fn((_code: string, _verifier: string) =>
      Promise.resolve(session('access-1', 'refresh-1')),
    ),
    renew: vi.fn((_refreshToken: string) => Promise.resolve(session('access-2', 'refresh-2'))),
    revoke: vi.fn((_token: string) => Promise.resolve()),
  }
}

function harness(): Harness {
  const storage = memoryStorage()
  const gateway = gatewayMock()
  let current = NOW

  return {
    gateway,
    manager: sessionManager({
      gateway,
      now: () => current,
      pending: pendingAuthorizationStore(storage),
      randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
      sha256: async (input) =>
        new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', input)),
      store: sessionStore(storage),
    }),
    setNow: (at) => {
      current = at
    },
    storage,
  }
}

/** The anti-forgery value the manager just stored, as GitLab would return it. */
function pendingStateOf(storage: KeyValueStorage): string {
  const parsed: unknown = JSON.parse(storage.read(PENDING_KEY) ?? '{}')

  if (typeof parsed !== 'object' || parsed === null || !('state' in parsed)) {
    throw new Error('no authorization is pending')
  }

  return String(parsed.state)
}

function session(accessToken: string, refreshToken: string): Session {
  return { accessToken, expiresInSeconds: 7200, refreshToken }
}

/** A harness that has completed a sign-in, which most behaviour starts from. */
async function signedIn(destination = '/'): Promise<Harness> {
  const instance = harness()

  await instance.manager.startSignIn(destination)
  await instance.manager.completeSignIn('the-code', pendingStateOf(instance.storage))

  return instance
}

describe('startSignIn', () => {
  it('returns somewhere to send the reader', async () => {
    const { manager } = harness()

    await expect(manager.startSignIn('/')).resolves.toContain('/oauth/authorize')
  })

  it('remembers where the reader was heading', async () => {
    const { manager, storage } = harness()

    await manager.startSignIn('/days/2026-08-20')

    expect(storage.read(PENDING_KEY)).toContain('/days/2026-08-20')
  })

  it('sends the challenge out and keeps the verifier back', async () => {
    const { gateway, manager, storage } = harness()

    await manager.startSignIn('/')

    const sent = gateway.authorizeUrl.mock.calls.at(0)?.[0]

    // base64url, unpadded: what the challenge and state must look like on the wire.
    expect(sent?.challenge).toMatch(/^[\w-]+$/)
    expect(sent?.state).toMatch(/^[\w-]+$/)
    expect(storage.read(PENDING_KEY)).toContain('verifier')
  })

  it('uses a fresh verifier and state for every attempt', async () => {
    const first = harness()
    const second = harness()

    await first.manager.startSignIn('/')
    await second.manager.startSignIn('/')

    expect(first.storage.read(PENDING_KEY)).not.toBe(second.storage.read(PENDING_KEY))
  })
})

describe('completeSignIn', () => {
  it('exchanges the code and returns the remembered destination', async () => {
    const instance = harness()
    await instance.manager.startSignIn('/days/2026-08-20')

    await expect(
      instance.manager.completeSignIn('the-code', pendingStateOf(instance.storage)),
    ).resolves.toBe('/days/2026-08-20')
    expect(instance.gateway.exchangeCode).toHaveBeenCalledTimes(1)
  })

  it('establishes a session', async () => {
    const instance = await signedIn()

    expect(instance.manager.hasSession()).toBe(true)
    await expect(instance.manager.accessToken()).resolves.toBe('access-1')
  })

  it('refuses a callback whose state does not match', async () => {
    const instance = harness()
    await instance.manager.startSignIn('/')

    await expect(
      instance.manager.completeSignIn('the-code', 'not-the-state'),
    ).rejects.toMatchObject({ failure: { kind: 'state-mismatch' } })
    expect(instance.gateway.exchangeCode).not.toHaveBeenCalled()
    expect(instance.manager.hasSession()).toBe(false)
  })

  it('refuses a callback when nothing is pending', async () => {
    const instance = harness()

    await expect(instance.manager.completeSignIn('the-code', 'some-state')).rejects.toBeInstanceOf(
      AuthError,
    )
  })

  it('refuses a replayed callback, because the verifier is single use', async () => {
    const instance = harness()
    await instance.manager.startSignIn('/')
    const state = pendingStateOf(instance.storage)

    await instance.manager.completeSignIn('the-code', state)

    await expect(instance.manager.completeSignIn('the-code', state)).rejects.toMatchObject({
      failure: { kind: 'state-mismatch' },
    })
  })
})

describe('accessToken', () => {
  it('reuses a credential that is still good', async () => {
    const instance = await signedIn()

    await expect(instance.manager.accessToken()).resolves.toBe('access-1')
    await expect(instance.manager.accessToken()).resolves.toBe('access-1')
    expect(instance.gateway.renew).not.toHaveBeenCalled()
  })

  it('renews once the credential is due', async () => {
    const instance = await signedIn()

    instance.setNow(NOW + 2 * HOUR)

    await expect(instance.manager.accessToken()).resolves.toBe('access-2')
    expect(instance.gateway.renew).toHaveBeenCalledTimes(1)
  })

  it('keeps the rotated refresh token', async () => {
    const instance = await signedIn()

    instance.setNow(NOW + 2 * HOUR)
    await instance.manager.accessToken()

    expect(instance.storage.read(REFRESH_KEY)).toBe('refresh-2')
  })

  it('refuses when there is no session at all', async () => {
    const instance = harness()

    await expect(instance.manager.accessToken()).rejects.toMatchObject({
      failure: { kind: 'expired-session' },
    })
  })
})

describe('refresh', () => {
  it('renews exactly once for a burst of concurrent callers', async () => {
    const instance = await signedIn()

    const tokens = await Promise.all([
      instance.manager.refresh(),
      instance.manager.refresh(),
      instance.manager.refresh(),
      instance.manager.refresh(),
    ])

    // Four rejections, one renewal: GitLab rotates the refresh token on every
    // use, so four renewals would invalidate each other.
    expect(instance.gateway.renew).toHaveBeenCalledTimes(1)
    expect(tokens).toEqual(['access-2', 'access-2', 'access-2', 'access-2'])
  })

  it('starts a new renewal after the previous one settled', async () => {
    const instance = await signedIn()

    await instance.manager.refresh()
    await instance.manager.refresh()

    expect(instance.gateway.renew).toHaveBeenCalledTimes(2)
  })

  it('ends the session when the refresh token is refused', async () => {
    const instance = await signedIn()
    instance.gateway.renew.mockRejectedValueOnce(new AuthError({ kind: 'expired-session' }))

    await expect(instance.manager.refresh()).rejects.toMatchObject({
      failure: { kind: 'expired-session' },
    })
    expect(instance.manager.hasSession()).toBe(false)
    expect(instance.storage.read(REFRESH_KEY)).toBeNull()
  })

  it('shares one failure with every concurrent caller', async () => {
    const instance = await signedIn()
    instance.gateway.renew.mockRejectedValue(new AuthError({ kind: 'expired-session' }))

    const outcomes = await Promise.allSettled([
      instance.manager.refresh(),
      instance.manager.refresh(),
      instance.manager.refresh(),
    ])

    expect(outcomes.every((outcome) => outcome.status === 'rejected')).toBe(true)
    expect(instance.gateway.renew).toHaveBeenCalledTimes(1)
  })
})

describe('signOut', () => {
  it('asks GitLab to invalidate the credential and leaves nothing behind', async () => {
    const instance = await signedIn()

    await instance.manager.signOut()

    expect(instance.gateway.revoke).toHaveBeenCalledWith('refresh-1')
    expect(instance.manager.hasSession()).toBe(false)
    expect(instance.storage.read(REFRESH_KEY)).toBeNull()
  })

  it('signs out even when the revocation cannot be delivered', async () => {
    const instance = await signedIn()
    instance.gateway.revoke.mockRejectedValueOnce(new Error('offline'))

    await expect(instance.manager.signOut()).rejects.toThrow()
    expect(instance.manager.hasSession()).toBe(false)
  })

  it('does nothing to revoke when there was no session', async () => {
    const instance = harness()

    await instance.manager.signOut()

    expect(instance.gateway.revoke).not.toHaveBeenCalled()
  })
})
