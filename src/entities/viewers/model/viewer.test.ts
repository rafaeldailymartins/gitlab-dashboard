import { describe, expect, it } from 'vitest'

import { greetingNameOf } from './viewer'

describe('greetingNameOf', () => {
  it('greets by the first word of the name', () => {
    expect(greetingNameOf({ name: 'Rafael Daily Santos Martins' })).toBe('Rafael')
  })

  it('takes a single-word name whole', () => {
    expect(greetingNameOf({ name: 'Ada' })).toBe('Ada')
  })

  it('ignores the whitespace GitLab lets through', () => {
    expect(greetingNameOf({ name: '  Grace   Hopper ' })).toBe('Grace')
  })

  it('has nothing to greet when there is no viewer', () => {
    expect(greetingNameOf(null)).toBeNull()
  })

  it.each(['', ' '.repeat(3), '\t\n'])('has nothing to greet for %j', (name) => {
    // A greeting with a hole in it — "Hello, ," — is worse than no greeting.
    expect(greetingNameOf({ name })).toBeNull()
  })
})
