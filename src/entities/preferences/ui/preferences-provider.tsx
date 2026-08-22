import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo } from 'react'

import type { PreferencesStore } from '../api/preferences-store'
import type { Preferences } from '../model/preferences'
import type { ResolvedTheme, ThemeChoice } from '../model/theme'

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
}

interface PreferencesProviderProps {
  readonly children: ReactNode
  /** Injected so tests can supply memory-backed storage. */
  readonly store: PreferencesStore
}

const PreferencesContext = createContext<null | PreferencesContextValue>(null)

export function PreferencesProvider({ children, store }: PreferencesProviderProps) {
  const [preferences, setPreferences] = useStoredValue(
    useCallback(() => store.readPreferences(), [store]),
    useCallback(
      (next: Preferences) => {
        store.writePreferences(next)
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

  const resolvedTheme = resolveTheme(themeChoice, useSystemDarkMode())

  // The same class the inline script in index.html sets before the first paint.
  // Keeping it here means one owner for "what theme is in effect".
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [resolvedTheme])

  const value = useMemo(
    () => ({ preferences, resolvedTheme, setPreferences, setThemeChoice, themeChoice }),
    [preferences, resolvedTheme, setPreferences, setThemeChoice, themeChoice],
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
