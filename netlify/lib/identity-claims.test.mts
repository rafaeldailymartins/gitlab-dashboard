import type { JWTPayload } from 'jose'

import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'

import type { VerifierOptions } from './identity.mjs'

import { verifyIdentity } from './identity.mjs'

const ISSUER = 'https://gitlab.example'
const AUDIENCE = 'client-123'
const SUBJECT = '12345'

/** The claims named in `requiredClaims`, which is the list under test here. */
const REQUIRED = ['aud', 'exp', 'iat', 'iss', 'sub'] as const

let signer: CryptoKey
let options: VerifierOptions

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true })

  signer = pair.privateKey
  options = {
    audience: AUDIENCE,
    issuer: ISSUER,
    keys: createLocalJWKSet({
      keys: [{ ...(await exportJWK(pair.publicKey)), alg: 'RS256', use: 'sig' }],
    }),
  }
})

/** Every claim the verifier requires, each with a value it accepts. */
function complete(): JWTPayload {
  const now = Math.floor(Date.now() / 1000)

  return { aud: AUDIENCE, exp: now + 120, iat: now, iss: ISSUER, sub: SUBJECT }
}

/**
 * Signs a claims set exactly as handed over.
 *
 * Built as a payload rather than through `SignJWT`'s setters because every
 * refusal below is about a claim that is missing or misshapen, and the setters
 * exist to make those unexpressible.
 */
function signed(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).sign(signer)
}

function without(omitted: (typeof REQUIRED)[number]): JWTPayload {
  return Object.fromEntries(Object.entries(complete()).filter(([claim]) => claim !== omitted))
}

describe('the claims it insists on', () => {
  it('accepts an assertion carrying all of them', async () => {
    await expect(verifyIdentity(await signed(complete()), options)).resolves.toEqual({
      ok: true,
      sub: SUBJECT,
    })
  })

  it.each(REQUIRED)('refuses one with no %s claim', async (claim) => {
    // Three of these five would fail anyway, because naming an audience, an
    // issuer or a maximum age makes jose require the claim it reads. `exp` and
    // `sub` are required by this list alone: without it an assertion with no
    // expiry at all is a valid one, and one with no subject verifies into a
    // storage key built from nothing.
    await expect(verifyIdentity(await signed(without(claim)), options)).resolves.toMatchObject({
      ok: false,
    })
  })
})

describe('the subject it hands back', () => {
  it.each([
    ['one that would climb out of its key space', '../../somebody-else'],
    ['an empty one', ''],
    ['one carrying a path separator', 'ada/teams'],
    ['one longer than it will use as a key', 'a'.repeat(65)],
  ])('refuses %s', async (_shape, sub) => {
    // Not a trust check — the signature already settled trust. The shape of
    // what becomes part of a storage key is this module's to decide rather than
    // the provider's to change later.
    await expect(verifyIdentity(await signed({ ...complete(), sub }), options)).resolves.toEqual({
      ok: false,
      reason: 'unauthenticated',
    })
  })

  it('returns the subject and nothing else', async () => {
    const token = await signed({
      ...complete(),
      email: 'ada@example.com',
      groups_direct: ['acme/platform', 'acme/platform/squad-fiscal'],
      preferred_username: 'ada',
    })

    // `openid` puts the reader's whole direct group membership in the token, as
    // full paths — kilobytes of it on a real instance — and this module is the
    // only place any of it exists. The return type is what forbids it going
    // further; this is what proves the value agrees with the type, since a
    // verifier handing back the payload would satisfy the type just as well.
    await expect(verifyIdentity(token, options)).resolves.toStrictEqual({
      ok: true,
      sub: SUBJECT,
    })
  })
})
