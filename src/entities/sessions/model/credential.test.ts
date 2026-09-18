import { describe, expect, it } from 'vitest'

import {
  credentialFrom,
  identityFrom,
  isDueForRenewal,
  isIdentityDue,
  millisecondsUntilRenewal,
} from './credential'

const NOW = Date.UTC(2026, 7, 21, 12, 0, 0)
const MINUTE = 60_000
const HOUR = 60 * MINUTE

describe('credentialFrom', () => {
  it('turns a lifetime in seconds into an absolute expiry', () => {
    const credential = credentialFrom('token', 7200, NOW)

    expect(credential.accessToken).toBe('token')
    expect(credential.expiresAt).toBe(NOW + 2 * HOUR)
  })

  it('treats a lifetime of zero as expiring immediately', () => {
    expect(credentialFrom('token', 0, NOW).expiresAt).toBe(NOW)
  })
})

describe('isDueForRenewal', () => {
  it('is not due while there is more than the margin left', () => {
    const credential = credentialFrom('token', 7200, NOW)

    expect(isDueForRenewal(credential, NOW)).toBe(false)
    expect(isDueForRenewal(credential, NOW + HOUR)).toBe(false)
  })

  it('becomes due once the margin is reached', () => {
    const credential = credentialFrom('token', 7200, NOW)

    // The margin is a minute, so renewal starts a minute before expiry.
    expect(isDueForRenewal(credential, NOW + 2 * HOUR - MINUTE)).toBe(true)
    expect(isDueForRenewal(credential, NOW + 2 * HOUR - MINUTE - 1)).toBe(false)
  })

  it('is due for a credential that has already expired', () => {
    const credential = credentialFrom('token', 7200, NOW)

    expect(isDueForRenewal(credential, NOW + 3 * HOUR)).toBe(true)
  })

  it('is due for a credential that arrived already expired', () => {
    expect(isDueForRenewal(credentialFrom('token', 0, NOW), NOW)).toBe(true)
  })
})

describe('millisecondsUntilRenewal', () => {
  it('counts down to the renewal moment, not to expiry', () => {
    const credential = credentialFrom('token', 7200, NOW)

    expect(millisecondsUntilRenewal(credential, NOW)).toBe(2 * HOUR - MINUTE)
  })

  it('is zero once renewal is due, so a timer never gets a negative delay', () => {
    const credential = credentialFrom('token', 7200, NOW)

    expect(millisecondsUntilRenewal(credential, NOW + 2 * HOUR)).toBe(0)
    expect(millisecondsUntilRenewal(credential, NOW + 3 * HOUR)).toBe(0)
  })

  it('agrees with isDueForRenewal at every boundary', () => {
    const credential = credentialFrom('token', 7200, NOW)

    for (const at of [NOW, NOW + HOUR, NOW + 2 * HOUR - MINUTE, NOW + 3 * HOUR]) {
      expect(millisecondsUntilRenewal(credential, at) === 0).toBe(isDueForRenewal(credential, at))
    }
  })
})

/** A token shaped like GitLab's: only its `exp` is ever read. */
function idToken(expiresAt: number): string {
  const claims = JSON.stringify({ exp: Math.floor(expiresAt / 1000), sub: '42' })
  const payload = btoa(claims).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')

  return `header.${payload}.signature`
}

describe('identityFrom', () => {
  it('dates an assertion from the token rather than from the response', () => {
    const identity = identityFrom(idToken(NOW + 2 * MINUTE))

    expect(identity?.expiresAt).toBe(NOW + 2 * MINUTE)
  })

  it('is null when the grant carried no assertion', () => {
    expect(identityFrom(null)).toBeNull()
  })

  it('is null for an assertion this cannot date', () => {
    // One it cannot date is one it would otherwise treat as immortal, and spend
    // long after the store stopped accepting it.
    expect(identityFrom('not a token')).toBeNull()
  })
})

describe('isIdentityDue', () => {
  it('is not due while there is more than the margin left', () => {
    const identity = identityFrom(idToken(NOW + 2 * MINUTE))

    expect(identity && isIdentityDue(identity, NOW)).toBe(false)
  })

  it('becomes due once the margin is reached', () => {
    const identity = identityFrom(idToken(NOW + 2 * MINUTE))

    // The margin is twenty seconds — smaller than the access token's minute,
    // because a minute would throw away half of a two-minute assertion.
    expect(identity && isIdentityDue(identity, NOW + 2 * MINUTE - 20_000)).toBe(true)
    expect(identity && isIdentityDue(identity, NOW + 2 * MINUTE - 20_001)).toBe(false)
  })

  it('is due for one that has already expired', () => {
    const identity = identityFrom(idToken(NOW - MINUTE))

    expect(identity && isIdentityDue(identity, NOW)).toBe(true)
  })
})
