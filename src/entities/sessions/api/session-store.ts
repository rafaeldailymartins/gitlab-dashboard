import type { KeyValueStorage } from '@/shared/lib/storage'

import type { Credential } from '../model/credential'
import type { Session } from '../model/ports'

import { credentialFrom } from '../model/credential'

const REFRESH_TOKEN_KEY = 'gitlab.refreshToken'

export interface SessionStore {
  clear(): void
  readCredential(): Credential | null
  readRefreshToken(): null | string
  write(session: Session, now: number): Credential
}

/**
 * Where each half of a session lives.
 *
 * The access credential is a closure variable and never reaches storage, so an
 * injected script has to run while the tab is open to see it and it dies with
 * the tab. The refresh token has to persist for the reader to stay signed in
 * across visits; it is replaced on every use, so a copy taken from storage is
 * worthless as soon as the app renews.
 */
export function sessionStore(storage: KeyValueStorage): SessionStore {
  let credential: Credential | null = null

  return {
    clear() {
      credential = null
      storage.remove(REFRESH_TOKEN_KEY)
    },

    readCredential() {
      return credential
    },

    readRefreshToken() {
      return storage.read(REFRESH_TOKEN_KEY)
    },

    write(session, now) {
      credential = credentialFrom(session.accessToken, session.expiresInSeconds, now)
      storage.write(REFRESH_TOKEN_KEY, session.refreshToken)

      return credential
    },
  }
}
