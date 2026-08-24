import { describe, expect, it } from 'vitest'

import { memoryStorage } from '@/shared/lib/storage'

import { withWeekdayTarget } from '../model/daily-target'
import { DEFAULT_PREFERENCES, withDailyTarget, withTimeZone } from '../model/preferences'
import { preferencesStore } from './preferences-store'

describe('preferencesStore', () => {
  it('reads the defaults from empty storage', () => {
    const store = preferencesStore(memoryStorage())

    expect(store.readPreferences()).toEqual(DEFAULT_PREFERENCES)
    expect(store.readThemeChoice()).toBe('system')
  })

  it('round-trips preferences', () => {
    const store = preferencesStore(memoryStorage())
    const preferences = withTimeZone(
      withDailyTarget(
        DEFAULT_PREFERENCES,
        withWeekdayTarget(DEFAULT_PREFERENCES.dailyTarget, 5, 6),
      ),
      'Asia/Tokyo',
    )

    store.writePreferences(preferences)

    expect(store.readPreferences()).toEqual(preferences)
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
    store.writePreferences(withTimeZone(DEFAULT_PREFERENCES, 'UTC'))

    expect(store.readThemeChoice()).toBe('dark')
    expect(store.readPreferences().timeZone).toBe('UTC')
  })
})
