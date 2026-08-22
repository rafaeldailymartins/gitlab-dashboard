import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import type { GitLabConfig } from '@/shared/config'

import { AuthError } from '../model/auth-error'
import { gitLabAuthGateway } from './gitlab-oauth'

const CONFIG: GitLabConfig = { baseUrl: 'https://gitlab.example', clientId: 'client-123' }
const REDIRECT_URI = 'http://localhost:3000/auth/callback'

const TOKEN_URL = 'https://gitlab.example/oauth/token'
const REVOKE_URL = 'https://gitlab.example/oauth/revoke'

const server = setupServer()
const gateway = gitLabAuthGateway(CONFIG, REDIRECT_URI)

/** Captures what was actually sent, so the encoding itself is asserted. */
let lastBody: null | URLSearchParams = null

function respondWithToken(token: string, refresh: string) {
  return http.post(TOKEN_URL, async ({ request }) => {
    lastBody = new URLSearchParams(await request.text())

    return HttpResponse.json({ access_token: token, expires_in: 7200, refresh_token: refresh })
  })
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  lastBody = null
})

afterAll(() => {
  server.close()
})

describe('authorizeUrl', () => {
  const url = new URL(gateway.authorizeUrl({ challenge: 'the-challenge', state: 'the-state' }))

  it('points at the provider', () => {
    expect(url.origin).toBe('https://gitlab.example')
    expect(url.pathname).toBe('/oauth/authorize')
  })

  it('asks for an authorization code with an S256 challenge', () => {
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('code_challenge')).toBe('the-challenge')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('carries the anti-forgery value and where to come back to', () => {
    expect(url.searchParams.get('state')).toBe('the-state')
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI)
  })

  it('asks for read-only access only', () => {
    expect(url.searchParams.get('scope')).toBe('read_api')
  })

  it('carries the public client id and no secret', () => {
    expect(url.searchParams.get('client_id')).toBe('client-123')
    expect(url.searchParams.get('client_secret')).toBeNull()
  })

  it('never carries the verifier, which is the point of PKCE', () => {
    expect(url.searchParams.get('code_verifier')).toBeNull()
  })
})

describe('exchangeCode', () => {
  it('returns the session GitLab issued', async () => {
    server.use(respondWithToken('access-1', 'refresh-1'))

    await expect(gateway.exchangeCode('the-code', 'the-verifier')).resolves.toEqual({
      accessToken: 'access-1',
      expiresInSeconds: 7200,
      refreshToken: 'refresh-1',
    })
  })

  it('proves possession of the verifier, and sends no secret', async () => {
    server.use(respondWithToken('access-1', 'refresh-1'))

    await gateway.exchangeCode('the-code', 'the-verifier')

    expect(lastBody?.get('grant_type')).toBe('authorization_code')
    expect(lastBody?.get('code')).toBe('the-code')
    expect(lastBody?.get('code_verifier')).toBe('the-verifier')
    expect(lastBody?.get('client_id')).toBe('client-123')
    expect(lastBody?.get('client_secret')).toBeNull()
  })

  it('reports a refused authorization as an expired session', async () => {
    server.use(
      http.post(TOKEN_URL, () => HttpResponse.json({ error: 'invalid_grant' }, { status: 400 })),
    )

    await expect(gateway.exchangeCode('stale', 'verifier')).rejects.toMatchObject({
      failure: { kind: 'expired-session' },
    })
  })

  it('reports any other refusal as the provider being unavailable', async () => {
    server.use(
      http.post(TOKEN_URL, () => HttpResponse.json({ error: 'server_error' }, { status: 500 })),
    )

    await expect(gateway.exchangeCode('code', 'verifier')).rejects.toBeInstanceOf(AuthError)
  })

  it('reports an unreachable provider rather than leaking a network error', async () => {
    server.use(http.post(TOKEN_URL, () => HttpResponse.error()))

    await expect(gateway.exchangeCode('code', 'verifier')).rejects.toMatchObject({
      failure: { kind: 'provider-unavailable' },
    })
  })

  it('refuses a response that is not a token', async () => {
    server.use(http.post(TOKEN_URL, () => HttpResponse.json({ hello: 'world' })))

    await expect(gateway.exchangeCode('code', 'verifier')).rejects.toMatchObject({
      failure: { kind: 'provider-unavailable' },
    })
  })

  it('refuses a response that is not JSON at all', async () => {
    server.use(http.post(TOKEN_URL, () => HttpResponse.text('<html>maintenance</html>')))

    await expect(gateway.exchangeCode('code', 'verifier')).rejects.toBeInstanceOf(AuthError)
  })
})

describe('renew', () => {
  it('exchanges the refresh token and receives a rotated one', async () => {
    server.use(respondWithToken('access-2', 'refresh-2'))

    const session = await gateway.renew('refresh-1')

    expect(lastBody?.get('grant_type')).toBe('refresh_token')
    expect(lastBody?.get('refresh_token')).toBe('refresh-1')
    expect(lastBody?.get('client_secret')).toBeNull()
    expect(session.refreshToken).toBe('refresh-2')
  })

  it('reports a refresh token GitLab no longer accepts as an expired session', async () => {
    server.use(
      http.post(TOKEN_URL, () => HttpResponse.json({ error: 'invalid_grant' }, { status: 400 })),
    )

    await expect(gateway.renew('stale')).rejects.toMatchObject({
      failure: { kind: 'expired-session' },
    })
  })
})

describe('revoke', () => {
  it('asks GitLab to invalidate the token', async () => {
    server.use(
      http.post(REVOKE_URL, async ({ request }) => {
        lastBody = new URLSearchParams(await request.text())

        return new HttpResponse(null, { status: 200 })
      }),
    )

    await gateway.revoke('refresh-1')

    expect(lastBody?.get('token')).toBe('refresh-1')
    expect(lastBody?.get('client_id')).toBe('client-123')
  })

  it('does not fail when the request cannot be delivered', async () => {
    server.use(http.post(REVOKE_URL, () => HttpResponse.error()))

    await expect(gateway.revoke('refresh-1')).resolves.toBeUndefined()
  })
})

describe('when GitLab answers an error with something other than JSON', () => {
  it('reports the provider as unavailable rather than guessing', async () => {
    // A gateway or proxy in front of GitLab returning an HTML error page.
    server.use(
      http.post(TOKEN_URL, () =>
        HttpResponse.text('<html>502 Bad Gateway</html>', { status: 502 }),
      ),
    )

    await expect(gateway.exchangeCode('code', 'verifier')).rejects.toMatchObject({
      failure: { kind: 'provider-unavailable' },
    })
  })
})
