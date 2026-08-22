import type { ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { vi } from 'vitest'

import { PreferencesProvider, preferencesStore } from '@/entities/preferences'
import { type TimelogGateway, TimelogGatewayProvider, type TimelogPage } from '@/entities/timelogs'
import { LocaleProvider } from '@/shared/i18n'
import { type KeyValueStorage, memoryStorage } from '@/shared/lib/storage'

interface ReportRenderOptions {
  readonly gateway?: TimelogGateway
  readonly storage?: KeyValueStorage
}

/** A gateway that always fails, for the paths where GitLab does not answer. */
export function failingGateway(error: Error) {
  return { myTimelogs: vi.fn(() => Promise.reject(error)) } satisfies TimelogGateway
}

/** A gateway that answers with the pages given, in order. */
export function fakeGateway(pages: TimelogPage[]) {
  let call = 0

  const myTimelogs = vi.fn(() => {
    const page = pages[Math.min(call, pages.length - 1)]
    call += 1

    return Promise.resolve(page ?? { entries: [], nextCursor: null })
  })

  return { myTimelogs } satisfies TimelogGateway
}

/**
 * Renders inside the providers a screen reading hours needs.
 *
 * Retries are off: a test asserting a failure should not wait for the retries
 * the real client makes, and a test asserting success never needs them.
 */
export function renderReport(ui: ReactNode, options: ReportRenderOptions = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const gateway = options.gateway ?? fakeGateway([{ entries: [], nextCursor: null }])
  const store = preferencesStore(options.storage ?? memoryStorage())

  const inProviders = (screen: ReactNode) => (
    <QueryClientProvider client={client}>
      <PreferencesProvider store={store}>
        <LocaleProvider>
          <TimelogGatewayProvider gateway={gateway}>{screen}</TimelogGatewayProvider>
        </LocaleProvider>
      </PreferencesProvider>
    </QueryClientProvider>
  )

  const view = render(inProviders(ui))

  return {
    ...view,
    client,
    gateway,
    // Overrides the one from Testing Library, which would drop the providers.
    rerender: (next: ReactNode) => {
      view.rerender(inProviders(next))
    },
  }
}

/**
 * The same providers, plus a router, for a screen that links or navigates.
 *
 * The router is a real one over an in-memory history rather than a mocked
 * `useNavigate`: what a test wants to know is which address a control leads to,
 * and the router's own location is the only honest answer. The day screen is a
 * stub — this helper is for the screens that link to it, not for the screen
 * itself.
 */
export function renderRoutedReport(ui: ReactNode, options: ReportRenderOptions = {}) {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    component: () => ui,
    getParentRoute: () => rootRoute,
    path: '/',
  })
  const dayRoute = createRoute({
    component: () => <p>Day screen</p>,
    getParentRoute: () => rootRoute,
    path: '/days/$date',
  })

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute.addChildren([indexRoute, dayRoute]),
  })

  return { router, ...renderReport(<RouterProvider router={router} />, options) }
}
