import { describe, expect, it } from 'vitest'

import { credentialFrom, isDueForRenewal, millisecondsUntilRenewal } from './credential'

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
