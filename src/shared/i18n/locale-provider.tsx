import {
  createContext,
  Fragment,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { getLocale, type Locale, setLocale } from '@/paraglide/runtime.js'

interface ActiveLocale {
  changeLocale: (next: Locale) => void
  readonly locale: Locale
}

const LocaleContext = createContext<ActiveLocale | null>(null)

/**
 * Holds the active language in React state.
 *
 * The compiled messages read the language when they are called, so switching it
 * only becomes visible if React renders again — that is what this state is for.
 * It lives in `shared` rather than in the language-switching feature because
 * every layer needs to read the active language to format dates and numbers,
 * and a feature cannot be imported by another feature.
 */
export function LocaleProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getLocale())

  const changeLocale = useCallback((next: Locale) => {
    // `reload: false` keeps the page alive, per the requirement that switching
    // language takes effect without a reload.
    void setLocale(next, { reload: false })
    setLocaleState(next)
  }, [])

  // Assistive technology needs to know which language it is reading.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo(() => ({ changeLocale, locale }), [changeLocale, locale])

  // The compiled messages are plain functions, so a component that renders one
  // without also reading this context would keep the old language: React skips
  // re-rendering a subtree whose element it already holds. Keying on the locale
  // forces the whole subtree to render again, which is the only way to reach
  // components that do not subscribe. The cost is that switching language
  // remounts the content below, so this provider sits inside the ones whose
  // state has to survive.
  return (
    <LocaleContext.Provider value={value}>
      <Fragment key={locale}>{children}</Fragment>
    </LocaleContext.Provider>
  )
}

export function useActiveLocale(): ActiveLocale {
  const value = useContext(LocaleContext)

  if (!value) {
    throw new Error('useActiveLocale was called outside a LocaleProvider')
  }

  return value
}
