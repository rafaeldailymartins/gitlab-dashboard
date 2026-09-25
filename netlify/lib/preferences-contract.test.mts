import { describe, expect, it } from 'vitest'

import type { StoredPreferences } from '../../src/entities/preferences/model/preferences'

import {
  decodeStoredPreferences,
  DEFAULT_PREFERENCES,
  encodeStoredPreferences,
  withDailyTarget,
  withTimeZone,
} from '../../src/entities/preferences/model/preferences'
import { PREFERENCES_DOCUMENT } from './preferences-document.mjs'

/**
 * The two readers of one stored shape, held against each other.
 *
 * The same pair as `teams-contract.test.mts`, for the same reason and with the
 * same one-way rule. The browser's codec is lenient because it is recovering
 * from something already stored; the endpoint's validator is strict because it
 * is deciding what may be stored at all. They are allowed to disagree in exactly
 * one direction: everything the browser writes, the endpoint must accept.
 *
 * The other way round is worse here than it is for a team, because nobody is
 * watching. A settings write happens in the background, so a document the
 * endpoint refuses shows up as one quiet line saying the settings are not
 * reaching the reader's other devices — with no field to correct and nothing on
 * screen that could explain it.
 *
 * `encodeStoredPreferences` is the browser's own wire shape; the gateway adds
 * the version and nothing else, which is what `sent` does below.
 */

/** What the gateway puts on the wire: the device's encoding, plus the version. */
function sent(stored: StoredPreferences): string {
  return JSON.stringify({ ...JSON.parse(encodeStoredPreferences(stored)), version: 1 })
}

const INSTANT = '2026-09-23T10:00:00.000Z'

const HELD: readonly { name: string; stored: StoredPreferences }[] = [
  { name: 'the defaults', stored: { preferences: DEFAULT_PREFERENCES, updatedAt: INSTANT } },
  {
    name: 'a zone on the other side of the date line',
    stored: {
      preferences: withTimeZone(DEFAULT_PREFERENCES, 'Pacific/Auckland'),
      updatedAt: INSTANT,
    },
  },
  {
    name: 'a week nobody works',
    stored: {
      preferences: withDailyTarget(DEFAULT_PREFERENCES, {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
        7: 0,
      }),
      updatedAt: INSTANT,
    },
  },
  {
    name: 'the ceiling on every day',
    stored: {
      preferences: withDailyTarget(DEFAULT_PREFERENCES, {
        1: 24,
        2: 24,
        3: 24,
        4: 24,
        5: 24,
        6: 24,
        7: 24,
      }),
      updatedAt: INSTANT,
    },
  },
  {
    name: 'a part-time week with a fraction in it',
    stored: {
      preferences: withDailyTarget(DEFAULT_PREFERENCES, {
        1: 7.5,
        2: 7.5,
        3: 7.5,
        4: 7.5,
        5: 4,
        6: 0,
        7: 0,
      }),
      updatedAt: INSTANT,
    },
  },
]

describe('what the browser writes, the endpoint accepts', () => {
  it.each(HELD)('$name', ({ stored }) => {
    expect(PREFERENCES_DOCUMENT.parse(sent(stored)).ok).toBe(true)
  })

  it.each(HELD)('and reads back as the same settings: $name', ({ stored }) => {
    const back = decodeStoredPreferences(sent(stored))

    expect(back.preferences).toEqual(stored.preferences)
    expect(back.updatedAt).toBe(stored.updatedAt)
  })
})

describe('what the browser recovers from, and the endpoint refuses', () => {
  const DAMAGED = JSON.stringify({
    dailyTarget: { 1: 'eight', 2: 8, 3: 8, 4: 8, 5: 8, 6: 0, 7: 0 },
    timeZone: 'Mars/Olympus',
    updatedAt: 'not an instant',
    version: 1,
  })

  it('refuses the damaged document on the way in', () => {
    expect(PREFERENCES_DOCUMENT.parse(DAMAGED).ok).toBe(false)
  })

  it('recovers it field by field, so one bad value costs only itself', () => {
    const recovered = decodeStoredPreferences(DAMAGED)

    expect(recovered.preferences.timeZone).toBe(DEFAULT_PREFERENCES.timeZone)
    expect(recovered.preferences.dailyTarget[1]).toBe(DEFAULT_PREFERENCES.dailyTarget[1])
    expect(recovered.updatedAt).toBeNull()
  })

  /*
   * And the repair is not writable, which is the one place this pair differs
   * from the teams one: a recovered team is written straight back, while
   * recovered settings carry no instant, and the sync deliberately refuses to
   * send an undated document rather than have this refused. The endpoint and the
   * browser agree about that document — neither will move it — which is why the
   * rule lives in `use-preferences-sync.ts` and is asserted there too.
   */
  it('will not accept the repair either, because it carries no instant', () => {
    expect(PREFERENCES_DOCUMENT.parse(sent(decodeStoredPreferences(DAMAGED))).ok).toBe(false)
  })
})
