/** Why a sign-in attempt did not produce a session. */
export type AuthFailure =
  | { readonly kind: 'denied' }
  | { readonly kind: 'expired-session' }
  /**
   * The session works, and carries no identity this app can prove to its own
   * store. It was granted before the application asked for one, and GitLab
   * carries the original scopes forward on every renewal — so it never will.
   * Authorising once more repairs it; signing out would only lose the reader
   * their place.
   */
  | { readonly kind: 'identity-unavailable' }
  | { readonly kind: 'not-configured' }
  | { readonly kind: 'provider-unavailable' }
  | { readonly kind: 'state-mismatch' }

/**
 * Everything the app needs from an OAuth provider.
 *
 * It exists so the rules and the screens can be exercised without HTTP, not to
 * abstract over a second provider — there is one, and it is GitLab.
 */
export interface AuthGateway {
  /** Where to send the reader to authorise this application. */
  authorizeUrl(challenge: AuthorizationChallenge): string
  exchangeCode(code: string, verifier: string): Promise<Session>
  renew(refreshToken: string): Promise<Session>
  /** Asks GitLab to invalidate a token. Failure must not block signing out. */
  revoke(token: string): Promise<void>
}

/** The values an authorization request carries out to GitLab. */
export interface AuthorizationChallenge {
  readonly challenge: string
  readonly state: string
}

/** What GitLab hands back from a token exchange or a renewal. */
export interface Session {
  readonly accessToken: string
  readonly expiresInSeconds: number
  /**
   * GitLab's signed assertion of who the reader is, or null when the grant
   * carries no `openid` scope.
   *
   * It has its own lifetime, far shorter than the access token's, and it is not
   * read from `expiresInSeconds` — see `idTokenExpiryAt`.
   */
  readonly idToken: null | string
  readonly refreshToken: string
}
