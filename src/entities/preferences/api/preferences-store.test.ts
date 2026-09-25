import { describe, expect, it } from 'vitest'

import { memoryStorage } from '@/shared/lib/storage'

import { withWeekdayTarget } from '../model/daily-target'
import { DEFAULT_PREFERENCES, withDailyTarget, withTimeZone } from '../model/preferences'
import { preferencesStore } from './preferences-store'

const AT = '2026-09-23T10:00:00.000Z'

describe('preferencesStore', () => {
  it('reads the defaults from empty storage', () => {
    const store = preferencesStore(memoryStorage())

    expect(store.readStored().preferences).toEqual(DEFAULT_PREFERENCES)
    expect(store.readThemeChoice()).toBe('system')
  })

  /*
   * Null rather than a date. A device that has never recorded an instant is not
   * holding an old document, it is holding one nobody dated — and `reconcile`
   * answers those two opposite ways: an old one competes and loses, an unknown
   * one adopts rather than competing, which is what stops a fresh install
   * pushing its defaults over settings the reader really set elsewhere.
   */
  it('records no instant for settings that were never stored', () => {
    expect(preferencesStore(memoryStorage()).readStored().updatedAt).toBeNull()
  })

  it('round-trips preferences and the instant they were changed at', () => {
    const store = preferencesStore(memoryStorage())
    const preferences = withTimeZone(
      withDailyTarget(
        DEFAULT_PREFERENCES,
        withWeekdayTarget(DEFAULT_PREFERENCES.dailyTarget, 5, 6),
      ),
      'Asia/Tokyo',
    )

    store.writeStored({ preferences, updatedAt: AT })

    expect(store.readStored()).toEqual({ preferences, updatedAt: AT })
  })

  // What a device that predates the instant reads back: its settings, kept, and
  // no claim about when they were set.
  it('keeps settings written before there was an instant to record', () => {
    const storage = memoryStorage()

    storage.write('preferences', JSON.stringify({ ...DEFAULT_PREFERENCES, timeZone: 'UTC' }))

    expect(preferencesStore(storage).readStored()).toEqual({
      preferences: { ...DEFAULT_PREFERENCES, timeZone: 'UTC' },
      updatedAt: null,
    })
  })

  it('round-trips the theme choice', () => {
    const store = preferencesStore(memoryStorage())

    store.writeThemeChoice('dark')

    expect(store.readThemeChoice()).toBe('dark')
  })

  it('keeps the theme under its own key, readable without parsing JSON', () => {
    const storage = memoryStorage()
    const store = preferencesStore(storage)

    store.writeThemeChoice('light')

    // The inline script in index.html reads exactly this, before the bundle
    // loads, so it must stay a bare string.
    expect(storage.read('theme')).toBe('light')
  })

  it('keeps preferences and the theme independent', () => {
    const store = preferencesStore(memoryStorage())

    store.writeThemeChoice('dark')
    store.writeStored({
      preferences: withTimeZone(DEFAULT_PREFERENCES, 'UTC'),
      updatedAt: AT,
    })

    expect(store.readThemeChoice()).toBe('dark')
    expect(store.readStored().preferences.timeZone).toBe('UTC')
  })
})
