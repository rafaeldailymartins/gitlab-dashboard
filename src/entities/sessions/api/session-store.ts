import type { KeyValueStorage } from '@/shared/lib/storage'

import type { Credential, Identity } from '../model/credential'
import type { Session } from '../model/ports'

import { credentialFrom, identityFrom } from '../model/credential'

const REFRESH_TOKEN_KEY = 'gitlab.refreshToken'

export interface SessionStore {
  clear(): void
  readCredential(): Credential | null
  /** The identity assertion, or null when the grant carried none. */
  readIdentity(): Identity | null
  readRefreshToken(): null | string
  write(session: Session, now: number): Credential
}

/**
 * Where each part of a session lives.
 *
 * Neither the access credential nor the identity assertion reaches storage. Both
 * are closure variables, so an injected script has to run while the tab is open
 * to see either, and both die with the tab. The refresh token has to persist for
 * the reader to stay signed in across visits; it is replaced on every use, so a
 * copy taken from storage is worthless as soon as the app renews.
 */
export function sessionStore(storage: KeyValueStorage): SessionStore {
  let credential: Credential | null = null
  let identity: Identity | null = null

  return {
    clear() {
      credential = null
      identity = null
      storage.remove(REFRESH_TOKEN_KEY)
    },

    readCredential() {
      return credential
    },

    readIdentity() {
      return identity
    },

    readRefreshToken() {
      return storage.read(REFRESH_TOKEN_KEY)
    },

    write(session, now) {
      credential = credentialFrom(session.accessToken, session.expiresInSeconds, now)
      // Assigned rather than merged, so a session that loses the scope does not
      // keep an assertion from before it. Null is the honest answer there.
      identity = identityFrom(session.idToken)
      storage.write(REFRESH_TOKEN_KEY, session.refreshToken)

      return credential
    },
  }
}
