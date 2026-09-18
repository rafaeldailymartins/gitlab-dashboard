import { idTokenExpiryAt } from './id-token'

const MILLISECONDS_PER_SECOND = 1000

/**
 * Renewal starts this long before the token actually expires, so a request that
 * is already in flight cannot arrive after it has stopped being accepted.
 */
const RENEWAL_MARGIN_SECONDS = 60

/**
 * The same idea for an identity assertion, and deliberately a smaller number.
 *
 * GitLab's assertion lives two minutes where the access token lives two hours,
 * so the access token's sixty-second margin would throw away half of every
 * assertion's life and renew the session twice as often as anything needs.
 */
const IDENTITY_MARGIN_SECONDS = 20

/**
 * An access credential and when it stops being accepted.
 *
 * The token is held in memory only. It never reaches storage, so an injected
 * script has to be running while the tab is open to see it, and it dies with
 * the tab.
 */
export interface Credential {
  readonly accessToken: string
  /** Unix milliseconds. */
  readonly expiresAt: number
}

/**
 * An identity assertion and when it stops being accepted.
 *
 * Held in memory exactly as `Credential` is, and for the same reason. Unlike
 * `Credential`, its lifetime is read from the token rather than from the token
 * response: `expires_in` describes the access token, and these two do not expire
 * together.
 */
export interface Identity {
  /** Unix milliseconds. */
  readonly expiresAt: number
  readonly idToken: string
}

/**
 * Turns what GitLab returns — a lifetime in seconds — into an absolute instant,
 * so nothing downstream has to remember when the response arrived.
 */
export function credentialFrom(
  accessToken: string,
  expiresInSeconds: number,
  now: number,
): Credential {
  return {
    accessToken,
    expiresAt: now + expiresInSeconds * MILLISECONDS_PER_SECOND,
  }
}

/**
 * An assertion GitLab granted, or null when it granted none.
 *
 * Null for a token whose expiry cannot be read, too. An assertion this app
 * cannot date is one it would otherwise treat as immortal; treating it as absent
 * costs one token request instead.
 *
 * Whether a dated assertion is too old to spend is `isIdentityDue`'s question,
 * not this one's. Rejecting an expired token here would report a clock two
 * minutes fast as a session that never had an identity, which is the wrong
 * explanation and the wrong remedy.
 */
export function identityFrom(idToken: null | string): Identity | null {
  if (idToken === null) {
    return null
  }

  const expiresAt = idTokenExpiryAt(idToken)

  return expiresAt === null ? null : { expiresAt, idToken }
}

/**
 * True when the credential should be renewed now.
 *
 * A credential already past its expiry is due, and so is one inside the renewal
 * margin. Renewing early costs one request; renewing late costs the reader a
 * failed one.
 */
export function isDueForRenewal(credential: Credential, now: number): boolean {
  return credential.expiresAt - RENEWAL_MARGIN_SECONDS * MILLISECONDS_PER_SECOND <= now
}

/** True when the identity assertion is too close to expiry to spend. */
export function isIdentityDue(identity: Identity, now: number): boolean {
  return identity.expiresAt - IDENTITY_MARGIN_SECONDS * MILLISECONDS_PER_SECOND <= now
}

/** Milliseconds until renewal is due, or zero when it already is. */
export function millisecondsUntilRenewal(credential: Credential, now: number): number {
  const due = credential.expiresAt - RENEWAL_MARGIN_SECONDS * MILLISECONDS_PER_SECOND

  return Math.max(due - now, 0)
}
