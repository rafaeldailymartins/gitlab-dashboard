import { singleFlight } from '@/shared/lib/single-flight'

import type { Credential } from '../model/credential'
import type { RandomBytes, Sha256 } from '../model/pkce'
import type { AuthGateway } from '../model/ports'
import type { PendingAuthorizationStore } from './pending-authorization'
import type { SessionStore } from './session-store'

import { AuthError } from '../model/auth-error'
import { isDueForRenewal, isIdentityDue } from '../model/credential'
import { challengeFor, createState, createVerifier } from '../model/pkce'

export interface SessionManager {
  /** A usable access token, renewing first if the current one is due. */
  accessToken(): Promise<string>
  /** Validates the callback, exchanges the code, and returns the destination. */
  completeSignIn(code: string, state: string): Promise<string>
  /** True while a refresh token is held, so a session can be resumed. */
  hasSession(): boolean
  /**
   * A live identity assertion, renewing first if the one held is due.
   *
   * @throws AuthError `identity-unavailable` when GitLab answers without one.
   */
  identityToken(): Promise<string>
  /** Discards the current credential and returns a fresh one. */
  refresh(): Promise<string>
  signOut(): Promise<void>
  /** Builds the authorization URL and remembers where the reader was heading. */
  startSignIn(destination: string): Promise<string>
}

export interface SessionManagerDependencies {
  readonly gateway: AuthGateway
  readonly now: () => number
  readonly pending: PendingAuthorizationStore
  readonly randomBytes: RandomBytes
  readonly sha256: Sha256
  readonly store: SessionStore
}

export function sessionManager(dependencies: SessionManagerDependencies): SessionManager {
  const { gateway, now, pending, store } = dependencies

  // One renewal per burst. GitLab rotates the refresh token on every use, so
  // four simultaneous renewals would invalidate each other.
  const renew = singleFlight(() => renewOnce(dependencies))

  return {
    async accessToken() {
      return accessTokenFor(dependencies, renew)
    },

    async completeSignIn(code, state) {
      const request = pending.consume()

      if (request?.state !== state) {
        throw new AuthError({ kind: 'state-mismatch' })
      }

      store.write(await gateway.exchangeCode(code, request.verifier), now())

      return request.destination
    },

    hasSession() {
      return store.readRefreshToken() !== null
    },

    async identityToken() {
      return identityTokenFor(dependencies, renew)
    },

    async refresh() {
      const renewed = await renew()

      return renewed.accessToken
    },

    async signOut() {
      const refreshToken = store.readRefreshToken()

      // Cleared first, so a slow or failing revocation never leaves the reader
      // looking signed in.
      store.clear()

      if (refreshToken !== null) {
        await gateway.revoke(refreshToken)
      }
    },

    async startSignIn(destination) {
      return authorizeUrlFor(dependencies, destination)
    },
  }
}

/** A usable access token, renewing first if the one held is due. */
async function accessTokenFor(
  { now, store }: SessionManagerDependencies,
  renew: () => Promise<Credential>,
): Promise<string> {
  const current = store.readCredential()

  if (current && !isDueForRenewal(current, now())) {
    return current.accessToken
  }

  const renewed = await renew()

  return renewed.accessToken
}

async function authorizeUrlFor(
  { gateway, pending, randomBytes, sha256 }: SessionManagerDependencies,
  destination: string,
): Promise<string> {
  const verifier = createVerifier(randomBytes)
  const state = createState(randomBytes)
  const challenge = await challengeFor(verifier, sha256)

  pending.write({ destination, state, verifier })

  return gateway.authorizeUrl({ challenge, state })
}

/**
 * A live identity assertion, renewing first if the one held is due.
 *
 * `renew` is the manager's own single flight rather than a fresh one. An
 * assertion lives two minutes, so this runs often, and routing it anywhere else
 * would make a burst of team requests rotate the refresh token several times
 * over — which GitLab does on every use.
 */
async function identityTokenFor(
  { now, store }: SessionManagerDependencies,
  renew: () => Promise<Credential>,
): Promise<string> {
  const current = store.readIdentity()

  if (current && !isIdentityDue(current, now())) {
    return current.idToken
  }

  await renew()

  const renewed = store.readIdentity()

  if (renewed === null) {
    // GitLab answered, and answered without an identity. This grant predates the
    // scope, and renewing carries the original scopes forward — so it never
    // will. The reader authorises once more; their hours are fine meanwhile.
    throw new AuthError({ kind: 'identity-unavailable' })
  }

  // Returned even when it is still due, which only a clock far enough out to
  // matter can cause. The store that accepts it is the authority on whether it
  // is acceptable, and its refusal is a better answer than a guess here.
  return renewed.idToken
}

async function renewOnce({ gateway, now, store }: SessionManagerDependencies): Promise<Credential> {
  const refreshToken = store.readRefreshToken()

  if (refreshToken === null) {
    throw new AuthError({ kind: 'expired-session' })
  }

  try {
    return store.write(await gateway.renew(refreshToken), now())
  } catch (error) {
    // A refresh token GitLab refuses is worth nothing; keeping it would only
    // make every later request fail the same way.
    store.clear()
    throw error
  }
}
