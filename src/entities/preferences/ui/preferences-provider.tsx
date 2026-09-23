import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo } from 'react'

import type { PreferencesStore } from '../api/preferences-store'
import type { PreferencesGateway } from '../model/ports'
import type { Preferences, StoredPreferences } from '../model/preferences'
import type { ResolvedTheme, ThemeChoice } from '../model/theme'

import { usePreferencesSync } from '../lib/use-preferences-sync'
import { useStoredValue } from '../lib/use-stored-value'
import { useSystemDarkMode } from '../lib/use-system-dark-mode'
import { resolveTheme } from '../model/theme'

export interface PreferencesContextValue {
  readonly preferences: Preferences
  /** The theme actually in effect, with `system` already resolved. */
  readonly resolvedTheme: ResolvedTheme
  setPreferences: (next: Preferences) => void
  setThemeChoice: (next: ThemeChoice) => void
  readonly themeChoice: ThemeChoice
  /** True when the settings are not reaching the reader's other devices. */
  readonly unsynced: boolean
}

interface PreferencesProviderProps {
  readonly children: ReactNode
  /**
   * Carries the settings between the reader's devices, or absent.
   *
   * Optional because two callers have nothing to hand it: a test, and the
   * screen shown when the application has no client id and so no session to
   * prove anybody with. Both then behave exactly as this provider did before
   * there was a store at all.
   */
  readonly gateway?: null | PreferencesGateway
  /** Injected so tests can supply memory-backed storage. */
  readonly store: PreferencesStore
}

const PreferencesContext = createContext<null | PreferencesContextValue>(null)

/**
 * The reader's settings, from the device first and the store afterwards.
 *
 * The device is the read path and stays it: `useStoredValue` reads
 * `localStorage` lazily on the first render, so every screen paints the
 * reader's own numbers with no request and no skeleton. The store is a second
 * opinion that arrives later and can only ever replace them with something the
 * same reader wrote more recently somewhere else.
 *
 * Which is why the instant is stamped here rather than in the model. The rules
 * may not reach for a clock; this is the one place that knows a change is being
 * made *now*, and `updatedAt` is what makes two devices resolvable without
 * asking anybody.
 */
export function PreferencesProvider({ children, gateway = null, store }: PreferencesProviderProps) {
  const [stored, setStored] = useStoredValue(
    useCallback(() => store.readStored(), [store]),
    useCallback(
      (next: StoredPreferences) => {
        store.writeStored(next)
      },
      [store],
    ),
  )

  const [themeChoice, setThemeChoice] = useStoredValue(
    useCallback(() => store.readThemeChoice(), [store]),
    useCallback(
      (next: ThemeChoice) => {
        store.writeThemeChoice(next)
      },
      [store],
    ),
  )

  const setPreferences = useCallback(
    (next: Preferences) => {
      setStored({ preferences: next, updatedAt: new Date().toISOString() })
    },
    [setStored],
  )

  const { failed } = usePreferencesSync({ gateway, onAdopt: setStored, settings: stored })
  const resolvedTheme = resolveTheme(themeChoice, useSystemDarkMode())

  // The same class the inline script in index.html sets before the first paint.
  // Keeping it here means one owner for "what theme is in effect".
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [resolvedTheme])

  const value = useMemo(
    () => ({
      preferences: stored.preferences,
      resolvedTheme,
      setPreferences,
      setThemeChoice,
      themeChoice,
      unsynced: failed,
    }),
    [stored.preferences, resolvedTheme, setPreferences, setThemeChoice, themeChoice, failed],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext)

  if (!value) {
    throw new Error('usePreferences was called outside a PreferencesProvider')
  }

  return value
}
