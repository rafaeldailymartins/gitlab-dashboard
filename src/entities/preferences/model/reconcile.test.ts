import { describe, expect, it } from 'vitest'

import type { StoredPreferences } from './preferences'

import { DEFAULT_PREFERENCES } from './preferences'
import { reconcile } from './reconcile'

const EARLIER = '2026-09-22T10:00:00.000Z'
const LATER = '2026-09-23T10:00:00.000Z'

function stored(updatedAt: null | string): StoredPreferences {
  return { preferences: DEFAULT_PREFERENCES, updatedAt }
}

describe('reconcile', () => {
  it('sends the device’s settings when the store holds none', () => {
    expect(reconcile(stored(EARLIER), null)).toBe('push')
  })

  it('takes the store’s when it was written later', () => {
    expect(reconcile(stored(EARLIER), stored(LATER))).toBe('adopt')
  })

  it('sends the device’s when it was changed later', () => {
    expect(reconcile(stored(LATER), stored(EARLIER))).toBe('push')
  })

  // Two documents stamped the same millisecond are one device reading itself
  // back. Answering `push` would make an idle tab write on every reconciliation.
  it('does nothing when the two were stamped together', () => {
    expect(reconcile(stored(LATER), stored(LATER))).toBe('agree')
  })
})

/*
 * The half of the rule that is about provenance rather than order. A device that
 * has never recorded an instant is not holding an old document — it is holding
 * one nobody dated — and the two call for opposite answers.
 */
describe('a device that has never recorded an instant', () => {
  // What stops a fresh install — defaults, nothing recorded — from pushing those
  // defaults over settings the reader really set on another machine.
  it('takes whatever the store holds rather than competing with it', () => {
    expect(reconcile(stored(null), stored(EARLIER))).toBe('adopt')
    expect(reconcile(stored(null), stored(LATER))).toBe('adopt')
  })

  // What carries settings a device was already holding before any of this
  // existed, without waiting for the reader to touch a field.
  it('is beaten by a device that does know when it wrote', () => {
    expect(reconcile(stored(LATER), stored(null))).toBe('push')
  })

  /*
   * The one case where such a device does compete, and it competes with nobody:
   * there is nothing stored to lose, and this is what carries the settings of a
   * device that was holding them before any of this existed. A device holding
   * only defaults pays one write for it.
   */
  it('fills a store that holds nothing at all', () => {
    expect(reconcile(stored(null), null)).toBe('push')
  })

  /*
   * Both sides unknown used to answer `agree` while the two held different
   * settings, so neither adopted and they drifted apart in silence. Taking the
   * store's copy is what makes them converge on one of the two.
   */
  it('takes the store’s copy when neither side knows, so the two converge', () => {
    expect(reconcile(stored(null), stored(null))).toBe('adopt')
  })
})
