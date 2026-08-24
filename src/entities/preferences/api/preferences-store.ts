import type { KeyValueStorage } from '@/shared/lib/storage'

import {
  decodePreferences,
  encodePreferences,
  type Preferences,
  PREFERENCES_STORAGE_KEY,
} from '../model/preferences'
import { decodeThemeChoice, THEME_STORAGE_KEY, type ThemeChoice } from '../model/theme'

/**
 * Persistence for the reader's settings. The theme is kept under its own key
 * because an inline script reads it before the first paint; everything else is
 * one JSON document.
 */
export interface PreferencesStore {
  readPreferences(): Preferences
  readThemeChoice(): ThemeChoice
  writePreferences(preferences: Preferences): void
  writeThemeChoice(choice: ThemeChoice): void
}

export function preferencesStore(storage: KeyValueStorage): PreferencesStore {
  return {
    readPreferences() {
      return decodePreferences(storage.read(PREFERENCES_STORAGE_KEY))
    },
    readThemeChoice() {
      return decodeThemeChoice(storage.read(THEME_STORAGE_KEY))
    },
    writePreferences(preferences) {
      storage.write(PREFERENCES_STORAGE_KEY, encodePreferences(preferences))
    },
    writeThemeChoice(choice) {
      storage.write(THEME_STORAGE_KEY, choice)
    },
  }
}
