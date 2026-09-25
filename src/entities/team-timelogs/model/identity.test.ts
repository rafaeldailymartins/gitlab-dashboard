import { describe, expect, it } from 'vitest'
import { ANA, BRUNO, member } from '~tests/support/gitlab-team-timelogs'

import { identityLookup, personOf } from './identity'

describe('identityLookup', () => {
  it('confirms somebody the provider resolved', () => {
    expect(identityLookup([ANA])(member(ANA))).toEqual({ kind: 'confirmed', person: ANA })
  })

  it('leaves somebody the provider said nothing about unresolved', () => {
    expect(identityLookup([ANA])(member(BRUNO))).toEqual({ kind: 'unresolved' })
  })

  it('matches on the identifier, never on the stored handle', () => {
    // GitLab releases a username on rename and another account may claim it.
    // Matching on the handle would fold a stranger's hours into this row.
    const renamed = { ...ANA, username: 'ana.carolina' }

    expect(identityLookup([renamed])(member(ANA))).toEqual({
      kind: 'confirmed',
      person: renamed,
    })
  })

  it('leaves somebody unresolved when the provider answered about others only', () => {
    // The provider promises no order and returns fewer nodes than it was asked
    // identifiers, so which names are missing can only come from the two sets.
    const identityOf = identityLookup([BRUNO])

    expect(identityOf(member(ANA))).toEqual({ kind: 'unresolved' })
    expect(identityOf(member(BRUNO))).toEqual({ kind: 'confirmed', person: BRUNO })
  })
})

describe('personOf', () => {
  it('gives the resolved person behind a confirmed row', () => {
    expect(personOf({ kind: 'confirmed', person: ANA })).toBe(ANA)
  })

  it('gives nothing to link to when nobody was resolved', () => {
    expect(personOf({ kind: 'unresolved' })).toBeNull()
  })
})
