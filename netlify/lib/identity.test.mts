import type { JWK } from 'jose'

import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'

import type { VerifierOptions } from './identity.mjs'

import { verifyIdentity } from './identity.mjs'

const ISSUER = 'https://gitlab.example'
const AUDIENCE = 'client-123'
const SUBJECT = '12345'

let signer: CryptoKey
let signerJwk: JWK
let strangerSigner: CryptoKey
let options: VerifierOptions

/**
 * A real RS256 signature over a locally minted key, so the verifier is exercised
 * at the level it actually defends: a test that stubbed the signature check
 * would assert the claim reading and nothing else.
 */
beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true })
  const stranger = await generateKeyPair('RS256', { extractable: true })

  signer = pair.privateKey
  signerJwk = { ...(await exportJWK(pair.publicKey)), alg: 'RS256', use: 'sig' }
  strangerSigner = stranger.privateKey
  options = {
    audience: AUDIENCE,
    issuer: ISSUER,
    keys: createLocalJWKSet({ keys: [signerJwk] }),
  }
})

interface Claims {
  readonly audience?: string
  readonly issuedAt?: number
  readonly issuer?: string
}

/**
 * A complete assertion this verifier accepts, with one thing about it changed.
 *
 * Which claims it insists on, and what it hands back, are in
 * `identity-claims.test.mts`: this file is about the assertion itself.
 */
async function assertion(claims: Claims = {}, key: CryptoKey = signer): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(claims.issuer ?? ISSUER)
    .setAudience(claims.audience ?? AUDIENCE)
    .setSubject(SUBJECT)
    .setIssuedAt(claims.issuedAt ?? now)
    .setExpirationTime((claims.issuedAt ?? now) + 120)
    .sign(key)
}

describe('verifyIdentity', () => {
  it('accepts an assertion the provider signed for this application', async () => {
    await expect(verifyIdentity(await assertion(), options)).resolves.toEqual({
      ok: true,
      sub: SUBJECT,
    })
  })

  it('refuses one signed by a key the provider does not publish', async () => {
    const token = await assertion({}, strangerSigner)

    await expect(verifyIdentity(token, options)).resolves.toEqual({
      ok: false,
      reason: 'unauthenticated',
    })
  })

  it('refuses one signed with an algorithm it does not name', async () => {
    const elliptic = await generateKeyPair('ES256', { extractable: true })
    const keys = createLocalJWKSet({
      keys: [signerJwk, { ...(await exportJWK(elliptic.publicKey)), alg: 'ES256', use: 'sig' }],
    })
    const now = Math.floor(Date.now() / 1000)
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject(SUBJECT)
      .setIssuedAt(now)
      .setExpirationTime(now + 120)
      .sign(elliptic.privateKey)

    // This key set publishes the elliptic key too, and it still verifies the
    // RS256 assertion beside it — so the named algorithm is the only thing left
    // that can be refusing. That is the whole of the defence against a token
    // choosing the scheme its own signature is checked under.
    await expect(verifyIdentity(await assertion(), { ...options, keys })).resolves.toMatchObject({
      ok: true,
    })
    await expect(verifyIdentity(token, { ...options, keys })).resolves.toMatchObject({ ok: false })
  })

  it('refuses one the provider signed as something other than an id token', async () => {
    const now = Math.floor(Date.now() / 1000)
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', typ: 'logout+jwt' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject(SUBJECT)
      .setIssuedAt(now)
      .setExpirationTime(now + 120)
      .sign(signer)

    // Every claim here is right and the signature is the provider's own. A
    // provider mints other assertions about the same person with the same key —
    // a logout token, an access token in JWT form — and `typ` is what stops one
    // of those being presented here as a sign-in.
    await expect(verifyIdentity(token, options)).resolves.toMatchObject({ ok: false })
  })

  it('refuses one whose signature no longer matches its payload', async () => {
    const token = await assertion()
    const [header, , signature] = token.split('.')
    const forged = btoa(JSON.stringify({ aud: AUDIENCE, sub: 'somebody-else' }))

    await expect(
      verifyIdentity(`${String(header)}.${forged}.${String(signature)}`, options),
    ).resolves.toMatchObject({ ok: false })
  })

  it('refuses one issued for another application', async () => {
    // GitLab access tokens carry no audience at all, which is why this app
    // verifies an assertion rather than forwarding one. Losing this check would
    // accept any other OAuth application's token for the same person.
    const token = await assertion({ audience: 'somebody-elses-client' })

    await expect(verifyIdentity(token, options)).resolves.toMatchObject({ ok: false })
  })

  it('refuses one from another issuer', async () => {
    const token = await assertion({ issuer: 'https://gitlab.attacker.example' })

    await expect(verifyIdentity(token, options)).resolves.toMatchObject({ ok: false })
  })

  it('refuses one that has expired', async () => {
    // Issued and expired well before the clock tolerance could rescue it.
    const token = await assertion({ issuedAt: Math.floor(Date.now() / 1000) - 600 })

    await expect(verifyIdentity(token, options)).resolves.toMatchObject({ ok: false })
  })

  it('refuses one minted long ago but given a generous expiry', async () => {
    const now = Math.floor(Date.now() / 1000)
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject(SUBJECT)
      .setIssuedAt(now - 600)
      .setExpirationTime(now + 3600)
      .sign(signer)

    // `exp` alone would accept this. The age bound is what keeps a replayed
    // assertion from being a long-lived credential.
    await expect(verifyIdentity(token, options)).resolves.toMatchObject({ ok: false })
  })

  it('refuses an unsigned assertion', async () => {
    const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
    const payload = btoa(JSON.stringify({ aud: AUDIENCE, iss: ISSUER, sub: SUBJECT }))

    await expect(verifyIdentity(`${header}.${payload}.`, options)).resolves.toMatchObject({
      ok: false,
    })
  })

  it('refuses something that is not a token at all', async () => {
    await expect(verifyIdentity('', options)).resolves.toMatchObject({ ok: false })
    await expect(verifyIdentity('not.a.token', options)).resolves.toMatchObject({ ok: false })
  })
})
