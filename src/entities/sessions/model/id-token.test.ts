import { describe, expect, it } from 'vitest'

import { idTokenExpiryAt } from './id-token'

const EXPIRY_SECONDS = 1_787_400_000

function base64url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCodePoint(byte)
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

/** A JWT this app only ever reads: header and signature are never inspected. */
function token(payload: unknown, parts = 3): string {
  const segments = ['eyJhbGciOiJSUzI1NiJ9', base64url(JSON.stringify(payload)), 'signature']

  return segments.slice(0, parts).join('.')
}

describe('idTokenExpiryAt', () => {
  it('reads the expiry as an absolute instant in milliseconds', () => {
    expect(idTokenExpiryAt(token({ exp: EXPIRY_SECONDS, sub: '42' }))).toBe(EXPIRY_SECONDS * 1000)
  })

  it('reads a payload carrying non-ASCII claims', () => {
    // GitLab puts `groups_direct` in the assertion, and a group path can carry
    // an accent. Decoding byte-per-character would corrupt it and take
    // `JSON.parse` down, which would make the reader renew on every request.
    const claims = { exp: EXPIRY_SECONDS, groups_direct: ['invenção/fiscal'], sub: '42' }

    expect(idTokenExpiryAt(token(claims))).toBe(EXPIRY_SECONDS * 1000)
  })

  it('is null for a token that is not three segments', () => {
    expect(idTokenExpiryAt(token({ exp: EXPIRY_SECONDS }, 2))).toBeNull()
    expect(idTokenExpiryAt('')).toBeNull()
  })

  it('is null when the payload is not base64url', () => {
    expect(idTokenExpiryAt('header.!!!not base64!!!.signature')).toBeNull()
  })

  it('is null when the payload is valid base64url but not JSON', () => {
    expect(idTokenExpiryAt(`header.${base64url('not json at all')}.signature`)).toBeNull()
  })

  it('is null when the payload is JSON but not an object', () => {
    expect(idTokenExpiryAt(token(['exp', EXPIRY_SECONDS]))).toBeNull()
    expect(idTokenExpiryAt(token(null))).toBeNull()
    expect(idTokenExpiryAt(token(EXPIRY_SECONDS))).toBeNull()
  })

  it('is null when there is no expiry', () => {
    expect(idTokenExpiryAt(token({ sub: '42' }))).toBeNull()
  })

  it('is null when the expiry is not a finite number', () => {
    expect(idTokenExpiryAt(token({ exp: '1787400000' }))).toBeNull()
    expect(idTokenExpiryAt(token({ exp: null }))).toBeNull()
    // JSON has no Infinity, so this is what a payload claiming one looks like.
    expect(idTokenExpiryAt(`header.${base64url('{"exp":1e999}')}.signature`)).toBeNull()
  })
})
