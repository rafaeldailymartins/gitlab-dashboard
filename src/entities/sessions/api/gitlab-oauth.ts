import type { GitLabConfig } from '@/shared/config'

import type { AuthGateway, AuthorizationChallenge, Session } from '../model/ports'

import { AuthError } from '../model/auth-error'

/** Read-only. The dashboard has no write path, so it asks for no write access. */
const SCOPE = 'read_api'

/** GitLab rejects a credential it no longer accepts with this error code. */
const INVALID_GRANT = 'invalid_grant'

/**
 * How long signing out waits for GitLab to acknowledge the revocation. Long
 * enough for a slow connection, short enough that nobody stares at their own
 * hours after asking to be signed out.
 */
const REVOKE_TIMEOUT_MS = 3000

interface TokenResponse {
  readonly access_token: string
  readonly expires_in: number
  readonly refresh_token: string
}

/**
 * GitLab's OAuth endpoints, as a PKCE public client.
 *
 * Every request is form-encoded and carries the client id but no secret: a
 * non-confidential application has none, which is what makes the flow safe to
 * complete in a browser.
 */
export function gitLabAuthGateway(config: GitLabConfig, redirectUri: string): AuthGateway {
  return {
    authorizeUrl: (challenge) => authorizeUrl(config, redirectUri, challenge),

    exchangeCode: async (code, verifier) =>
      requestToken(config, {
        client_id: config.clientId,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),

    renew: async (refreshToken) =>
      requestToken(config, {
        client_id: config.clientId,
        grant_type: 'refresh_token',
        redirect_uri: redirectUri,
        refresh_token: refreshToken,
      }),

    revoke: async (token) => revoke(config, token),
  }
}

function authorizeUrl(
  config: GitLabConfig,
  redirectUri: string,
  { challenge, state }: AuthorizationChallenge,
): string {
  const url = new URL('/oauth/authorize', config.baseUrl)

  url.search = new URLSearchParams({
    client_id: config.clientId,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    state,
  }).toString()

  return url.toString()
}

async function failureFor(response: Response): Promise<AuthError['failure']> {
  const payload = await readJson(response).catch(() => null)
  const error = isRecord(payload) ? payload['error'] : null

  return error === INVALID_GRANT ? { kind: 'expired-session' } : { kind: 'provider-unavailable' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isTokenResponse(payload: unknown): payload is TokenResponse {
  return (
    isRecord(payload) &&
    typeof payload['access_token'] === 'string' &&
    typeof payload['refresh_token'] === 'string' &&
    typeof payload['expires_in'] === 'number'
  )
}

async function post(url: URL, body: Record<string, string>): Promise<Response> {
  try {
    return await fetch(url, { body: new URLSearchParams(body), method: 'POST' })
  } catch {
    throw new AuthError({ kind: 'provider-unavailable' })
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch {
    throw new AuthError({ kind: 'provider-unavailable' })
  }
}

async function requestToken(config: GitLabConfig, body: Record<string, string>): Promise<Session> {
  const response = await post(new URL('/oauth/token', config.baseUrl), body)

  if (!response.ok) {
    throw new AuthError(await failureFor(response))
  }

  return sessionFrom(await readJson(response))
}

async function revoke(config: GitLabConfig, token: string): Promise<void> {
  // A revocation that cannot be delivered must not block signing out: the local
  // session is cleared either way, so the failure is swallowed here.
  //
  // The timeout is the point. Swallowing a rejection does nothing for a request
  // that never settles, and signing out awaits this one before it clears the
  // cached report and moves the reader off the dashboard — so a hung revocation
  // used to leave someone looking signed out, on a screen full of their hours,
  // with the cache still on the device.
  try {
    await fetch(new URL('/oauth/revoke', config.baseUrl), {
      body: new URLSearchParams({ client_id: config.clientId, token }),
      method: 'POST',
      signal: AbortSignal.timeout(REVOKE_TIMEOUT_MS),
    })
  } catch {
    /* the credential expires on its own; nothing else to do */
  }
}

function sessionFrom(payload: unknown): Session {
  if (!isTokenResponse(payload)) {
    throw new AuthError({ kind: 'provider-unavailable' })
  }

  return {
    accessToken: payload.access_token,
    expiresInSeconds: payload.expires_in,
    refreshToken: payload.refresh_token,
  }
}
