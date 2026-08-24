import { describe, expect, it } from 'vitest'

import { challengeFor, createState, createVerifier, type RandomBytes, type Sha256 } from './pkce'

/**
 * RFC 7636 Appendix B publishes this verifier and the challenge it must produce.
 * Testing against the specification's own vector proves the derivation, not just
 * that our two functions agree with each other.
 */
const RFC_7636_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
const RFC_7636_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'

/**
 * Real SHA-256 through the platform's Web Crypto, which is the same API the
 * browser adapter uses — so the vector above exercises the real derivation.
 */
const sha256: Sha256 = async (input) =>
  new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', input))

/** Predictable bytes, for asserting shape rather than randomness. */
const countingBytes: RandomBytes = (size) =>
  Uint8Array.from({ length: size }, (_value, index) => index % 256)

const realRandomBytes: RandomBytes = (size) =>
  globalThis.crypto.getRandomValues(new Uint8Array(size))

/** RFC 7636 section 4.1: the unreserved set. */
const UNRESERVED = /^[A-Za-z0-9\-._~]+$/

describe('createVerifier', () => {
  it('is long enough and short enough for RFC 7636', () => {
    const verifier = createVerifier(realRandomBytes)

    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier.length).toBeLessThanOrEqual(128)
  })

  it('is exactly 64 characters, from 48 random bytes', () => {
    // Pinned rather than merely range-checked, so changing the byte count is a
    // deliberate decision and not a silent drift.
    expect(createVerifier(realRandomBytes)).toHaveLength(64)
  })

  it('uses only characters the specification allows', () => {
    expect(createVerifier(realRandomBytes)).toMatch(UNRESERVED)
  })

  it('never carries base64 padding or non-URL-safe characters', () => {
    const verifier = createVerifier(realRandomBytes)

    expect(verifier).not.toContain('=')
    expect(verifier).not.toContain('+')
    expect(verifier).not.toContain('/')
  })

  it('differs every time, so one cannot be replayed as another', () => {
    const verifiers = new Set(Array.from({ length: 50 }, () => createVerifier(realRandomBytes)))

    expect(verifiers.size).toBe(50)
  })

  it('derives the verifier from the bytes it is given', () => {
    expect(createVerifier(countingBytes)).toBe(createVerifier(countingBytes))
  })
})

describe('createState', () => {
  it('uses only characters the specification allows', () => {
    expect(createState(realRandomBytes)).toMatch(UNRESERVED)
  })

  it('differs every time', () => {
    const states = new Set(Array.from({ length: 50 }, () => createState(realRandomBytes)))

    expect(states.size).toBe(50)
  })

  it('is shorter than a verifier: it only has to be unguessable, not a secret', () => {
    expect(createState(realRandomBytes).length).toBeLessThan(createVerifier(realRandomBytes).length)
  })
})

describe('challengeFor', () => {
  it("reproduces the specification's own test vector", async () => {
    await expect(challengeFor(RFC_7636_VERIFIER, sha256)).resolves.toBe(RFC_7636_CHALLENGE)
  })

  it('is URL-safe and unpadded', async () => {
    const challenge = await challengeFor(createVerifier(realRandomBytes), sha256)

    expect(challenge).toMatch(UNRESERVED)
    expect(challenge).not.toContain('=')
  })

  it('is the same for the same verifier', async () => {
    const first = await challengeFor(RFC_7636_VERIFIER, sha256)
    const second = await challengeFor(RFC_7636_VERIFIER, sha256)

    expect(first).toBe(second)
  })

  it('differs for a different verifier', async () => {
    const other = await challengeFor(`${RFC_7636_VERIFIER}x`, sha256)

    expect(other).not.toBe(RFC_7636_CHALLENGE)
  })

  it('cannot be reversed into the verifier', async () => {
    const challenge = await challengeFor(RFC_7636_VERIFIER, sha256)

    expect(challenge).not.toContain(RFC_7636_VERIFIER)
  })
})
