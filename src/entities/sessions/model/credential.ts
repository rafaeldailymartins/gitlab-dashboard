const MILLISECONDS_PER_SECOND = 1000

/**
 * Renewal starts this long before the token actually expires, so a request that
 * is already in flight cannot arrive after it has stopped being accepted.
 */
const RENEWAL_MARGIN_SECONDS = 60

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
 * True when the credential should be renewed now.
 *
 * A credential already past its expiry is due, and so is one inside the renewal
 * margin. Renewing early costs one request; renewing late costs the reader a
 * failed one.
 */
export function isDueForRenewal(credential: Credential, now: number): boolean {
  return credential.expiresAt - RENEWAL_MARGIN_SECONDS * MILLISECONDS_PER_SECOND <= now
}

/** Milliseconds until renewal is due, or zero when it already is. */
export function millisecondsUntilRenewal(credential: Credential, now: number): number {
  const due = credential.expiresAt - RENEWAL_MARGIN_SECONDS * MILLISECONDS_PER_SECOND

  return Math.max(due - now, 0)
}
