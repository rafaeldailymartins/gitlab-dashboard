import { createRemoteJWKSet, jwtVerify } from 'jose'

/**
 * Who is calling, established from an assertion the provider signed.
 *
 * The whole of what leaves this module is a subject. GitLab's `openid` scope
 * puts far more than that in the token — `preferred_username`, `email`, and
 * `groups_direct`, which is every group the reader directly belongs to, as full
 * paths — and none of it has any business anywhere else. The return type is the
 * enforcement, and `no-console` is what stops it reaching a log instead.
 */
export type Identity =
  | { readonly ok: false; readonly reason: 'unauthenticated' | 'unavailable' }
  | { readonly ok: true; readonly sub: string }

export interface VerifierOptions {
  /** The OAuth application's own id. An assertion for another app is not ours. */
  readonly audience: string
  readonly issuer: string
  readonly keys: KeySource
}

/** The key resolver `jwtVerify` takes, named so a test can supply a local one. */
type KeySource = Parameters<typeof jwtVerify>[1]

/**
 * How long a resolved key set is reused, matching the provider's own
 * `Cache-Control: max-age=86400` on the endpoint that serves it.
 */
const CACHE_MAX_AGE_MS = 86_400_000

/**
 * The shortest gap between two fetches of the key set.
 *
 * This is the whole answer to somebody spraying assertions with invented key
 * ids: an unknown id makes the resolver re-fetch, and this bounds that to one
 * request a minute per warm instance whatever arrives.
 */
const COOLDOWN_MS = 60_000

const KEYS_TIMEOUT_MS = 3000

/** Seconds of clock difference tolerated between this host and the provider. */
const CLOCK_TOLERANCE_SECONDS = 30

/**
 * The oldest assertion accepted, measured from `iat`.
 *
 * The provider's own lifetime is two minutes; this bounds replay independently
 * of whatever `exp` claims, so an assertion minted with a generous expiry by a
 * differently configured instance is still not a long-lived credential here.
 */
const MAX_AGE_SECONDS = 150

/**
 * Subjects this will use as a storage key.
 *
 * The provider's is a numeric user id, and OIDC permits any printable ASCII up
 * to 255. This is not a trust check — the signature already settled trust — it
 * is a shape check, so that what becomes part of a key is something this module
 * chose rather than something the provider might change later.
 */
const USABLE_SUBJECT = /^[\w-]{1,64}$/u

/**
 * The provider's signing keys, resolved once per cold start.
 *
 * Discovery decides where a signature will be trusted from, so a document
 * naming keys on another origin is refused rather than followed: whoever could
 * answer for that origin could otherwise mint identities here.
 */
export async function providerKeys(baseUrl: string): Promise<null | VerifierOptions['keys']> {
  const discovered = await discover(baseUrl)

  return discovered === null ? null : createRemoteJWKSet(new URL(discovered.jwksUri), JWKS_OPTIONS)
}

/**
 * Who signed this, or why it will not say.
 *
 * `unauthenticated` covers every way an assertion can fail — a bad signature, a
 * wrong audience, an expired or unreadable token — deliberately as one answer.
 * Which check failed is diagnostics for whoever sent it, and this endpoint
 * answers an unauthenticated internet.
 */
export async function verifyIdentity(token: string, options: VerifierOptions): Promise<Identity> {
  try {
    const { payload } = await jwtVerify(token, options.keys, {
      // Named rather than inferred from the key. Letting the token choose is
      // how algorithm confusion gets in, and the provider advertises one.
      algorithms: ['RS256'],
      audience: options.audience,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      issuer: options.issuer,
      maxTokenAge: MAX_AGE_SECONDS,
      requiredClaims: ['aud', 'exp', 'iat', 'iss', 'sub'],
      typ: 'JWT',
    })

    return subjectOf(payload.sub)
  } catch {
    return { ok: false, reason: 'unauthenticated' }
  }
}

const JWKS_OPTIONS = {
  cacheMaxAge: CACHE_MAX_AGE_MS,
  cooldownDuration: COOLDOWN_MS,
  timeoutDuration: KEYS_TIMEOUT_MS,
} as const

/** The provider's issuer and key endpoint, or null when it will not say. */
async function discover(baseUrl: string): Promise<null | { issuer: string; jwksUri: string }> {
  try {
    const response = await fetch(new URL('/.well-known/openid-configuration', baseUrl), {
      signal: AbortSignal.timeout(KEYS_TIMEOUT_MS),
    })

    return response.ok ? documentOf(await response.json(), baseUrl) : null
  } catch {
    return null
  }
}

function documentOf(payload: unknown, baseUrl: string): null | { issuer: string; jwksUri: string } {
  if (typeof payload !== 'object' || payload === null) {
    return null
  }

  const issuer: unknown = (payload as Record<string, unknown>)['issuer']
  const jwksUri: unknown = (payload as Record<string, unknown>)['jwks_uri']

  if (typeof issuer !== 'string' || typeof jwksUri !== 'string') {
    return null
  }

  return sameOrigin(jwksUri, baseUrl) ? { issuer, jwksUri } : null
}

function sameOrigin(candidate: string, baseUrl: string): boolean {
  try {
    return new URL(candidate).origin === new URL(baseUrl).origin
  } catch {
    return false
  }
}

function subjectOf(sub: string | undefined): Identity {
  return sub !== undefined && USABLE_SUBJECT.test(sub)
    ? { ok: true, sub }
    : { ok: false, reason: 'unauthenticated' }
}
