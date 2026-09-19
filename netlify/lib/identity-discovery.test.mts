import type { JWK } from 'jose'
import type { Mock } from 'vitest'

import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { providerKeys, verifyIdentity } from './identity.mjs'

const BASE = 'https://gitlab.example'
const DISCOVERY = `${BASE}/.well-known/openid-configuration`
const KEYS = `${BASE}/oauth/discovery/keys`
const AUDIENCE = 'client-123'
const SUBJECT = '12345'

let signer: CryptoKey
let published: { keys: JWK[] }

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true })

  signer = pair.privateKey
  published = { keys: [{ ...(await exportJWK(pair.publicKey)), alg: 'RS256', use: 'sig' }] }
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * What the module under test asks for, which is narrower than `fetch` takes:
 * discovery hands it a `URL` and jose hands it the key endpoint's href.
 */
type Asked = string | URL

type Responders = Readonly<Record<string, () => Response>>

function assertion(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(BASE)
    .setAudience(AUDIENCE)
    .setSubject(SUBJECT)
    .setIssuedAt(now)
    .setExpirationTime(now + 120)
    .sign(signer)
}

function document(jwksUri: string): () => Response {
  return () => Response.json({ issuer: BASE, jwks_uri: jwksUri })
}

/**
 * A provider that answers at the addresses named and nowhere else.
 *
 * The network is the only thing stubbed here. Discovery is a fetch and a
 * signature check over what it returns, so a test that mocked either of those
 * would be asserting the mock — while an address this does not serve rejects,
 * which is what an unreachable host does.
 */
function serving(responders: Responders): Mock<(input: Asked) => Promise<Response>> {
  const fetching = vi.fn((input: Asked) => {
    const responder = responders[String(input)]

    return responder === undefined
      ? Promise.reject(new TypeError(`nothing answers for ${String(input)}`))
      : Promise.resolve(responder())
  })

  vi.stubGlobal('fetch', fetching)

  return fetching
}

describe('providerKeys', () => {
  it("asks the provider's own discovery address", async () => {
    const fetching = serving({
      [DISCOVERY]: document(KEYS),
      [KEYS]: () => Response.json(published),
    })

    await providerKeys(BASE)

    expect(String(fetching.mock.calls[0]?.[0])).toBe(DISCOVERY)
  })

  it('returns a key source that verifies what the provider signed', async () => {
    serving({ [DISCOVERY]: document(KEYS), [KEYS]: () => Response.json(published) })

    const keys = await providerKeys(BASE)

    if (keys === null) {
      throw new Error('discovery refused a document it had every reason to accept')
    }

    // End to end, because a key source that resolves nothing would satisfy
    // `not.toBeNull()` and fail every sign-in on the deployed function.
    await expect(
      verifyIdentity(await assertion(), { audience: AUDIENCE, issuer: BASE, keys }),
    ).resolves.toEqual({ ok: true, sub: SUBJECT })
  })

  it.each([
    ['another host', 'https://keys.attacker.example/oauth/discovery/keys'],
    ['the same host without TLS', KEYS.replace('https:', 'http:')],
    ['another port on the same host', 'https://gitlab.example:8443/oauth/discovery/keys'],
    ['nothing that is an address', 'oauth/discovery/keys'],
  ])('refuses a document whose keys sit on %s', async (_where, jwksUri) => {
    const fetching = serving({ [DISCOVERY]: document(jwksUri) })

    // The document decides where a signature will be trusted from, so following
    // it off the configured origin would hand whoever can answer for that origin
    // the power to mint identities here. Refused before anything is fetched
    // from it: the key endpoint is never asked.
    await expect(providerKeys(BASE)).resolves.toBeNull()
    expect(fetching).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['answers with a failure', () => new Response('', { status: 500 })],
    ['answers with something that is not JSON', () => new Response('<html>nope</html>')],
    ['answers with no document at all', () => Response.json('a string')],
    ['names no key endpoint', () => Response.json({ issuer: BASE })],
    ['names one that is not text', () => Response.json({ issuer: BASE, jwks_uri: 42 })],
    ['names no issuer', () => Response.json({ jwks_uri: KEYS })],
  ])('gives no keys when the provider %s', async (_failure, respond) => {
    serving({ [DISCOVERY]: respond })

    await expect(providerKeys(BASE)).resolves.toBeNull()
  })

  it('gives no keys when the provider cannot be reached', async () => {
    serving({})

    // Answering null rather than throwing is what lets the function reply 503
    // to the reader: a cold instance that met a bad minute is not the same
    // thing as a credential that failed, and it must not read as one.
    await expect(providerKeys(BASE)).resolves.toBeNull()
  })
})
