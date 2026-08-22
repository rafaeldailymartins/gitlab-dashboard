import { useQueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createRootRoute, Link, Outlet, useNavigate } from '@tanstack/react-router'

import { appRuntime, callbackUri, navigateAway } from '@/app/lib/runtime'
import { PreferencesProvider, preferencesStore } from '@/entities/preferences'
import { SessionProvider, useSession } from '@/entities/sessions'
import { TimelogGatewayProvider } from '@/entities/timelogs'
import { ThemeToggle } from '@/features/theme'
import { NotConfiguredPage } from '@/pages/not-configured'
import { createQueryClient, queryCachePersister } from '@/shared/api'
import { LocaleProvider, m } from '@/shared/i18n'
import { persistentStorage } from '@/shared/lib/storage'
import { Button } from '@/shared/ui/button'

export const Route = createRootRoute({ component: RootLayout })

/**
 * Built once, at module scope, so the whole app reads and writes the same
 * storage. `persistentStorage` degrades to memory rather than throwing when a
 * browser denies access.
 */
const store = preferencesStore(persistentStorage())

/** One cache for the page, restored from IndexedDB before the first request. */
const queryClient = createQueryClient()
const persister = queryCachePersister()

const NAVIGATION_LINK_CLASS =
  'rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=page]:font-medium aria-[current=page]:text-foreground'

function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b">
        {/* Wraps rather than overflowing: at 375 pixels the brand and the two
            controls fill the first row and the navigation takes the second. */}
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <span className="font-semibold tracking-tight">{m.app_name()}</span>
          <SignedInControls />
        </div>
      </header>
      <Outlet />
    </div>
  )
}

/**
 * Preferences sit outside the locale provider because switching language
 * remounts everything below it, and the reader's settings must survive that.
 */
function RootLayout() {
  if (appRuntime.kind === 'missing-client-id') {
    return (
      <LocaleProvider>
        <NotConfiguredPage redirectUri={callbackUri()} />
      </LocaleProvider>
    )
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <PreferencesProvider store={store}>
        <LocaleProvider>
          <SessionProvider manager={appRuntime.manager} navigateAway={navigateAway}>
            <TimelogGatewayProvider gateway={appRuntime.timelogs}>
              <AppShell />
            </TimelogGatewayProvider>
          </SessionProvider>
        </LocaleProvider>
      </PreferencesProvider>
    </PersistQueryClientProvider>
  )
}

/** The navigation and sign-out only make sense once there is a session. */
function SignedInControls() {
  const { isSignedIn, signOut } = useSession()
  const client = useQueryClient()
  const navigate = useNavigate()

  /**
   * The route guard only runs on navigation, so signing out has to move the
   * reader itself — otherwise they would sit on a screen they no longer have a
   * session for. The cache goes with it, in memory and on disk, so one person's
   * hours never greet the next one on a shared device.
   */
  const leave = async (): Promise<void> => {
    await signOut()
    client.clear()
    await persister.removeClient()
    await navigate({ search: { next: '/' }, to: '/login' })
  }

  return (
    <>
      {isSignedIn ? (
        <nav
          aria-label={m.nav_label()}
          className="order-last flex w-full items-center gap-1 sm:order-none sm:w-auto"
        >
          <Link className={NAVIGATION_LINK_CLASS} to="/">
            {m.nav_dashboard()}
          </Link>
          <Link className={NAVIGATION_LINK_CLASS} to="/insights">
            {m.nav_insights()}
          </Link>
          <Link className={NAVIGATION_LINK_CLASS} to="/settings">
            {m.nav_settings()}
          </Link>
        </nav>
      ) : null}
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        {isSignedIn ? (
          <Button
            onClick={() => {
              void leave()
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            {m.sign_out_action()}
          </Button>
        ) : null}
      </div>
    </>
  )
}
