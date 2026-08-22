import { singleFlight } from '@/shared/lib/single-flight'

import type { Credential } from '../model/credential'
import type { RandomBytes, Sha256 } from '../model/pkce'
import type { AuthGateway } from '../model/ports'
import type { PendingAuthorizationStore } from './pending-authorization'
import type { SessionStore } from './session-store'

import { AuthError } from '../model/auth-error'
import { isDueForRenewal } from '../model/credential'
import { challengeFor, createState, createVerifier } from '../model/pkce'

export interface SessionManager {
  /** A usable access token, renewing first if the current one is due. */
  accessToken(): Promise<string>
  /** Validates the callback, exchanges the code, and returns the destination. */
  completeSignIn(code: string, state: string): Promise<string>
  /** True while a refresh token is held, so a session can be resumed. */
  hasSession(): boolean
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
      const current = store.readCredential()

      if (current && !isDueForRenewal(current, now())) {
        return current.accessToken
      }

      const renewed = await renew()

      return renewed.accessToken
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
