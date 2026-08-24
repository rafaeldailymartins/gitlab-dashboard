import { useEffect, useState } from 'react'

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'

/**
 * Whether the operating system currently asks for a dark interface, kept up to
 * date while the page is open so a reader who has not chosen a theme follows
 * the system as it changes.
 */
export function useSystemDarkMode(): boolean {
  const [prefersDark, setPrefersDark] = useState(() => matchDarkScheme()?.matches ?? false)

  useEffect(() => {
    const query = matchDarkScheme()

    if (!query) {
      return
    }

    const onChange = (event: MediaQueryListEvent): void => {
      setPrefersDark(event.matches)
    }

    query.addEventListener('change', onChange)

    return () => {
      query.removeEventListener('change', onChange)
    }
  }, [])

  return prefersDark
}

function matchDarkScheme(): MediaQueryList | null {
  return typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia(DARK_SCHEME_QUERY)
    : null
}
