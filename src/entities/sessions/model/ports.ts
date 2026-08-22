/** Why a sign-in attempt did not produce a session. */
export type AuthFailure =
  | { readonly kind: 'denied' }
  | { readonly kind: 'expired-session' }
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
  readonly refreshToken: string
}
