const MILLISECONDS_PER_SECOND = 1000
const PARTS = 3
const PAYLOAD = 1
const BASE64_BLOCK = 4

/**
 * When an identity assertion stops being accepted, read out of the token itself.
 *
 * The signature is not checked here, and must not be. This token reached this
 * browser over TLS in the answer to a request this browser made; there is no
 * adversary between those two points that a check here would catch. The check
 * that matters happens where the assertion is spent — on the store that accepts
 * it, against the provider's published keys. What the browser needs is only
 * "when do I ask for another one", and `exp` is the only field that answers it.
 *
 * The lifetime is read from the token rather than from the token response,
 * because `expires_in` describes the access token. GitLab's identity assertion
 * lives two minutes where the access token lives two hours, and treating them
 * as one number would hand the store an assertion expired an hour ago.
 */
export function idTokenExpiryAt(token: string): null | number {
  const payload = payloadOf(token)

  if (payload === null || typeof payload !== 'object' || !('exp' in payload)) {
    return null
  }

  const seconds: unknown = payload.exp

  return typeof seconds === 'number' && Number.isFinite(seconds)
    ? seconds * MILLISECONDS_PER_SECOND
    : null
}

/**
 * The bytes of a base64url segment.
 *
 * `atob` yields one character per byte, which is not the same as one character
 * per character: a claim carrying an accented group path decodes to mojibake
 * and can take `JSON.parse` down with it. Going back through the bytes and
 * decoding as UTF-8 is what stops a reader in one such group renewing their
 * session on every single request.
 */
function bytesOf(segment: string): Uint8Array {
  const padded = segment.replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(padded.padEnd(Math.ceil(padded.length / BASE64_BLOCK) * BASE64_BLOCK, '='))
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    // `charCodeAt`, not `codePointAt`, and the rule is wrong for this one case:
    // it guards Unicode correctness in *text*, and these are bytes. Every unit
    // `atob` produced is one, so a code point could never differ from a code
    // unit here — while `codePointAt` returns `number | undefined` and would add
    // a fallback branch no input can reach and no test can cover.
    // eslint-disable-next-line unicorn/prefer-code-point
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

/**
 * The claims, or null for anything this cannot read.
 *
 * Every unreadable shape returns null rather than throwing, and every caller
 * treats null as "already due". The cost of being wrong that way is one token
 * request; the cost of the other way is a store refusing a reader for reasons
 * neither of them can see.
 */
function payloadOf(token: string): unknown {
  const segments = token.split('.')

  if (segments.length !== PARTS || segments[PAYLOAD] === undefined) {
    return null
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytesOf(segments[PAYLOAD]))) as unknown
  } catch {
    return null
  }
}
