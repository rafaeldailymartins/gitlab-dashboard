import type { AuthFailure } from './ports'

/**
 * A sign-in or renewal that did not produce a session.
 *
 * It carries a `kind` rather than only a message so the interface can say
 * something useful — "you declined" reads differently from "GitLab is
 * unreachable" — and so a caller can tell a recoverable failure from a final
 * one without matching on prose.
 */
export class AuthError extends Error {
  readonly failure: AuthFailure

  constructor(failure: AuthFailure) {
    super(`Authentication failed: ${failure.kind}`)

    this.failure = failure
    this.name = 'AuthError'
  }
}

/** Narrows an unknown thrown value, so callers never guess. */
export function asAuthFailure(error: unknown): AuthFailure {
  return error instanceof AuthError ? error.failure : { kind: 'provider-unavailable' }
}
