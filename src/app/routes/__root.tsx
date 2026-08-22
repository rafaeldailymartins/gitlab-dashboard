import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

import { PreferencesProvider, preferencesStore } from '@/entities/preferences'
import { ThemeToggle } from '@/features/theme'
import { LocaleProvider, m } from '@/shared/i18n'
import { persistentStorage } from '@/shared/lib/storage'

export const Route = createRootRoute({ component: RootLayout })

/**
 * Built once, at module scope, so the whole app reads and writes the same
 * storage. `persistentStorage` degrades to memory rather than throwing when a
 * browser denies access.
 */
const store = preferencesStore(persistentStorage())

const NAVIGATION_LINK_CLASS =
  'rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=page]:font-medium aria-[current=page]:text-foreground'

/**
 * The application shell. Preferences sit outside the locale provider because
 * switching language remounts everything below it, and the reader's settings
 * must survive that.
 */
function RootLayout() {
  return (
    <PreferencesProvider store={store}>
      <LocaleProvider>
        <div className="flex min-h-dvh flex-col bg-background text-foreground">
          <header className="border-b">
            <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3">
              <span className="font-semibold tracking-tight">{m.app_name()}</span>
              <nav aria-label={m.app_name()} className="flex items-center gap-1">
                <Link className={NAVIGATION_LINK_CLASS} to="/">
                  {m.nav_dashboard()}
                </Link>
                <Link className={NAVIGATION_LINK_CLASS} to="/settings">
                  {m.nav_settings()}
                </Link>
              </nav>
              <div className="ml-auto">
                <ThemeToggle />
              </div>
            </div>
          </header>
          <Outlet />
        </div>
      </LocaleProvider>
    </PreferencesProvider>
  )
}
