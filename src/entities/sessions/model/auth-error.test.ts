import { describe, expect, it } from 'vitest'

import { asAuthFailure, AuthError } from './auth-error'

describe('AuthError', () => {
  it('carries the failure, so a caller never matches on prose', () => {
    expect(new AuthError({ kind: 'denied' }).failure).toEqual({ kind: 'denied' })
  })

  it('names the failure in its message, for whoever reads the log', () => {
    expect(new AuthError({ kind: 'state-mismatch' }).message).toContain('state-mismatch')
    expect(new AuthError({ kind: 'provider-unavailable' }).message).toMatch(
      /authentication failed/i,
    )
  })

  it('identifies itself by name', () => {
    expect(new AuthError({ kind: 'denied' }).name).toBe('AuthError')
  })

  it('is an Error, so it behaves like one everywhere', () => {
    expect(new AuthError({ kind: 'denied' })).toBeInstanceOf(Error)
  })
})

describe('asAuthFailure', () => {
  it('unwraps a failure it recognises', () => {
    expect(asAuthFailure(new AuthError({ kind: 'expired-session' }))).toEqual({
      kind: 'expired-session',
    })
  })

  it.each([
    ['a plain Error', new Error('something')],
    ['a string', 'something'],
    ['null', null],
    ['undefined', undefined],
    ['an object that only looks like one', { failure: { kind: 'denied' } }],
  ])('treats %s as the provider being unavailable', (_description, thrown) => {
    expect(asAuthFailure(thrown)).toEqual({ kind: 'provider-unavailable' })
  })
})
