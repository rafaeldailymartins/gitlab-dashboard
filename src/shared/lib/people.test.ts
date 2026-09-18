import { describe, expect, it } from 'vitest'

import { byNameThenUsername } from './people'

const ADA = { name: 'Ada Lovelace', username: 'ada' }
const GRACE = { name: 'Grace Hopper', username: 'grace' }

describe('byNameThenUsername', () => {
  it('orders by name', () => {
    expect(byNameThenUsername(ADA, GRACE)).toBeLessThan(0)
    expect(byNameThenUsername(GRACE, ADA)).toBeGreaterThan(0)
  })

  it('falls back to the username for two people who share a name', () => {
    const twin = { name: 'Ada Lovelace', username: 'ada2' }

    expect(byNameThenUsername(ADA, twin)).toBeLessThan(0)
    expect(byNameThenUsername(twin, ADA)).toBeGreaterThan(0)
  })

  it('does not depend on the machine it runs on', () => {
    // Code-unit comparison, not `localeCompare`: an uppercase letter sorts
    // before a lowercase one under every locale, which is what makes a domain
    // test that asserts an order reproducible anywhere.
    expect(
      byNameThenUsername({ name: 'Zoe', username: 'z' }, { name: 'ana', username: 'a' }),
    ).toBeLessThan(0)
  })
})
