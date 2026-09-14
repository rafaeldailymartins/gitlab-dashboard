import { defaultShouldDehydrateQuery, type Query } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createRootRoute, Outlet } from '@tanstack/react-router'

import { appCachePersister, appQueryClient } from '@/app/lib/query'
import { appRuntime, callbackUri, navigateAway } from '@/app/lib/runtime'
import { PreferencesProvider, preferencesStore } from '@/entities/preferences'
import { SessionProvider } from '@/entities/sessions'
import { TimelogGatewayProvider } from '@/entities/timelogs'
import { ViewerGatewayProvider } from '@/entities/viewers'
import { NotConfiguredPage } from '@/pages/not-configured'
import { LocaleProvider } from '@/shared/i18n'
import { persistentStorage } from '@/shared/lib/storage'

export const Route = createRootRoute({ component: RootLayout })

/**
 * Only what the reader is entitled to keep reaches the device's storage.
 *
 * Persisting an answer is what makes a return visit paint before any request
 * goes out, and for the reader's own hours that is the whole point. A query
 * that holds somebody else's says so on itself, so this rule needs to know
 * nothing about which screen asked.
 */
function shouldDehydrateQuery(query: Query): boolean {
  return query.meta?.['persist'] !== false && defaultShouldDehydrateQuery(query)
}

/**
 * Built once, at module scope, so the whole app reads and writes the same
 * storage. `persistentStorage` degrades to memory rather than throwing when a
 * browser denies access.
 */
const store = preferencesStore(persistentStorage())

/**
 * Preferences sit outside the locale provider because switching language
 * remounts everything below it, and the reader's settings must survive that.
 *
 * There is no header here. Signed-in chrome belongs to the `_authenticated`
 * layout, where a route guard has already established that there is a session;
 * the sign-in screen is full-bleed and carries its own mark and colour-scheme
 * control, and the callback screen exists for the half-second it takes to
 * finish.
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
    <PersistQueryClientProvider
      client={appQueryClient}
      persistOptions={{ dehydrateOptions: { shouldDehydrateQuery }, persister: appCachePersister }}
    >
      <PreferencesProvider store={store}>
        <LocaleProvider>
          <SessionProvider manager={appRuntime.manager} navigateAway={navigateAway}>
            <TimelogGatewayProvider gateway={appRuntime.timelogs}>
              <ViewerGatewayProvider gateway={appRuntime.viewer}>
                <div className="flex min-h-dvh flex-col bg-background text-foreground">
                  <Outlet />
                </div>
              </ViewerGatewayProvider>
            </TimelogGatewayProvider>
          </SessionProvider>
        </LocaleProvider>
      </PreferencesProvider>
    </PersistQueryClientProvider>
  )
}
