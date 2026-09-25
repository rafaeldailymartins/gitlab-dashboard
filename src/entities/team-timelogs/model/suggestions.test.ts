import { describe, expect, it } from 'vitest'
import { ANA, BRUNO, CAMILA, DIEGO, suggestedMember } from '~tests/support/gitlab-team-timelogs'

import { suggestionsFrom } from './suggestions'

describe('suggestionsFrom', () => {
  it('offers whoever logged time, once each', () => {
    const offered = suggestionsFrom([
      suggestedMember(ANA),
      suggestedMember(ANA),
      suggestedMember(BRUNO),
    ])

    expect(offered.map((one) => one.person.username)).toEqual([ANA.username, BRUNO.username])
  })

  it('deduplicates on the identifier rather than the handle', () => {
    // A username can change mid-window, and the same person under two of them
    // would otherwise be offered twice.
    const offered = suggestionsFrom([
      suggestedMember(ANA),
      suggestedMember({ ...ANA, username: 'ana.carolina' }),
    ])

    expect(offered).toHaveLength(1)
  })

  it('drops bots, which nobody manages a timesheet for', () => {
    const offered = suggestionsFrom([suggestedMember(ANA, { bot: true }), suggestedMember(BRUNO)])

    expect(offered.map((one) => one.person.username)).toEqual([BRUNO.username])
  })

  it('keeps somebody whose account is no longer active', () => {
    // They logged time in the window, so they did the work and have since been
    // blocked or left. That is the opposite of clutter.
    const offered = suggestionsFrom([suggestedMember(DIEGO, { active: false })])

    expect(offered).toEqual([suggestedMember(DIEGO, { active: false })])
  })

  it('keeps the first answer about somebody, so the newest entry wins', () => {
    const offered = suggestionsFrom([
      suggestedMember(ANA, { active: false }),
      suggestedMember(ANA, { active: true }),
    ])

    expect(offered[0]?.active).toBe(false)
  })

  it('orders by name, then by handle, independently of the reader’s locale', () => {
    const offered = suggestionsFrom([
      suggestedMember(CAMILA),
      suggestedMember(DIEGO),
      suggestedMember(ANA),
    ])

    expect(offered.map((one) => one.person.name)).toEqual([ANA.name, CAMILA.name, DIEGO.name])
  })

  it('offers nobody when nobody logged', () => {
    expect(suggestionsFrom([])).toEqual([])
  })
})
