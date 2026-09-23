import type { KeyValueStorage } from '@/shared/lib/storage'

import type { StoredPreferences } from '../model/preferences'

import {
  decodeStoredPreferences,
  encodeStoredPreferences,
  PREFERENCES_STORAGE_KEY,
} from '../model/preferences'
import { decodeThemeChoice, THEME_STORAGE_KEY, type ThemeChoice } from '../model/theme'

/**
 * Persistence for the reader's settings. The theme is kept under its own key
 * because an inline script reads it before the first paint; everything else is
 * one JSON document.
 *
 * That document carries the instant it was last changed at, beside the settings
 * themselves. It is what lets two of the reader's own devices tell which of them
 * wrote last, without either asking anybody — see `model/reconcile.ts`. The
 * instant lives on the envelope rather than inside `Preferences` because no
 * screen reading a target has any business with when it was set.
 */
export interface PreferencesStore {
  readStored(): StoredPreferences
  readThemeChoice(): ThemeChoice
  writeStored(stored: StoredPreferences): void
  writeThemeChoice(choice: ThemeChoice): void
}

export function preferencesStore(storage: KeyValueStorage): PreferencesStore {
  return {
    readStored() {
      return decodeStoredPreferences(storage.read(PREFERENCES_STORAGE_KEY))
    },
    readThemeChoice() {
      return decodeThemeChoice(storage.read(THEME_STORAGE_KEY))
    },
    writeStored(stored) {
      storage.write(PREFERENCES_STORAGE_KEY, encodeStoredPreferences(stored))
    },
    writeThemeChoice(choice) {
      storage.write(THEME_STORAGE_KEY, choice)
    },
  }
}
