/** What the reader asked for. `system` follows the operating system. */
export const THEME_CHOICES = ['system', 'light', 'dark'] as const

/** What actually gets painted. */
export type ResolvedTheme = 'dark' | 'light'

export type ThemeChoice = (typeof THEME_CHOICES)[number]

const DEFAULT_THEME_CHOICE: ThemeChoice = 'system'

/**
 * The key the theme is stored under.
 *
 * It is a plain string under its own key rather than a field inside the
 * preferences object, because an inline script in `index.html` has to read it
 * before the first paint. A tiny, stable contract is safer there than parsing
 * a structure whose shape could change.
 */
export const THEME_STORAGE_KEY = 'theme'

/** Reads a stored choice, treating anything unrecognised as "follow the system". */
export function decodeThemeChoice(stored: null | string): ThemeChoice {
  return THEME_CHOICES.find((choice) => choice === stored) ?? DEFAULT_THEME_CHOICE
}

/** The theme to paint, given the reader's choice and the system preference. */
export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ResolvedTheme {
  if (choice === 'system') {
    return systemPrefersDark ? 'dark' : 'light'
  }

  return choice
}
