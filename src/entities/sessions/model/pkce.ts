/**
 * Cryptographic randomness, injected rather than reached for, so these rules
 * stay pure and a test can make them deterministic.
 */
export type RandomBytes = (size: number) => Uint8Array<ArrayBuffer>

/** SHA-256 over bytes, injected for the same reason. */
export type Sha256 = (input: Uint8Array<ArrayBuffer>) => Promise<Uint8Array<ArrayBuffer>>

/**
 * 48 random bytes become 64 base64url characters — inside RFC 7636's 43..128
 * range, and every character is in its unreserved set. Encoding the bytes
 * rather than indexing an alphabet by `byte % length` avoids the modulo bias
 * that would make some characters likelier than others.
 */
const VERIFIER_BYTES = 48

/** 16 bytes is the usual size for an anti-forgery value. */
const STATE_BYTES = 16

/**
 * The `S256` challenge for a verifier: base64url of its SHA-256 digest.
 *
 * The authorization request carries this; only the token exchange carries the
 * verifier itself, which is what stops an intercepted code being redeemed.
 */
export async function challengeFor(verifier: string, sha256: Sha256): Promise<string> {
  return base64Url(await sha256(asciiBytes(verifier)))
}

/**
 * A single-use value carried through the redirect and compared on the way back,
 * so a callback that did not originate here is refused.
 */
export function createState(randomBytes: RandomBytes): string {
  return base64Url(randomBytes(STATE_BYTES))
}

/** A single-use secret the token exchange proves possession of. */
export function createVerifier(randomBytes: RandomBytes): string {
  return base64Url(randomBytes(VERIFIER_BYTES))
}

/** A verifier is ASCII, so UTF-8 bytes are its bytes. */
function asciiBytes(value: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(value)
}

function base64Url(bytes: Uint8Array): string {
  const binary = String.fromCodePoint(...bytes)

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}
