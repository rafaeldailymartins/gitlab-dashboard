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

import {
  type ColumnProbeAnswer,
  type ColumnProbeQuery,
  type GroupHoursPage,
  type GroupProbe,
  type GroupRef,
  type GroupTimelogGateway,
  GroupTimelogGatewayProvider,
  type RosterAnswer,
} from '@/entities/group-timelogs'
import { PreferencesProvider, preferencesStore } from '@/entities/preferences'
import { type TimelogGateway, TimelogGatewayProvider, type TimelogPage } from '@/entities/timelogs'
import { type ViewerGateway, ViewerGatewayProvider } from '@/entities/viewers'
import { LocaleProvider } from '@/shared/i18n'
import { type KeyValueStorage, memoryStorage } from '@/shared/lib/storage'

interface GroupAnswers {
  /** What the provider declares per column, by username. */
  readonly columns?: ReadonlyMap<string, ColumnProbeAnswer>
  readonly groups?: readonly GroupRef[]
  readonly pages?: readonly GroupHoursPage[]
  readonly probe?: GroupProbe
  readonly roster?: RosterAnswer
}

interface ReportRenderOptions {
  readonly gateway?: TimelogGateway
  readonly groups?: GroupTimelogGateway
  readonly storage?: KeyValueStorage
  readonly viewer?: ViewerGateway
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
 * A group gateway that answers with what it is given.
 *
 * The pages are handed out in order and the last one repeats, so a test that
 * says nothing about paging gets one page that ends the window.
 */
export function fakeGroupGateway(answers: GroupAnswers = {}) {
  const pages = answers.pages ?? [{ entries: [], group: SQUAD, nextCursor: null }]
  let call = 0

  return {
    columns: vi.fn((query: ColumnProbeQuery) =>
      Promise.resolve(
        answers.columns?.get(query.username) ?? {
          byColumn: new Map(),
          period: { entryCount: 0, seconds: 0 },
        },
      ),
    ),
    groups: vi.fn(() => Promise.resolve(answers.groups ?? [SQUAD])),
    probe: vi.fn(() =>
      Promise.resolve(
        answers.probe ?? {
          access: null,
          declared: { entryCount: 0, seconds: 0 },
          group: SQUAD,
          perPerson: new Map(),
        },
      ),
    ),
    roster: vi.fn(() =>
      Promise.resolve(answers.roster ?? { access: null, group: SQUAD, members: [] }),
    ),
    timelogs: vi.fn(() => {
      const page = pages[Math.min(call, pages.length - 1)]

      call += 1

      return Promise.resolve(page ?? { entries: [], group: SQUAD, nextCursor: null })
    }),
  } satisfies GroupTimelogGateway
}

/** The group every group fixture is about, unless a test says otherwise. */
export const SQUAD: GroupRef = { fullPath: 'acme/squad-fiscal', name: 'squad-fiscal' }

/** Whoever the screen greets. Named so an assertion on the greeting is obvious. */
export function fakeViewerGateway(name: null | string = 'Ada Lovelace') {
  return {
    me: vi.fn(() => Promise.resolve(name === null ? null : { name })),
  } satisfies ViewerGateway
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
  const viewer = options.viewer ?? fakeViewerGateway()
  const groups = options.groups ?? fakeGroupGateway()

  const inProviders = (screen: ReactNode) => (
    <QueryClientProvider client={client}>
      <PreferencesProvider store={store}>
        <LocaleProvider>
          <TimelogGatewayProvider gateway={gateway}>
            <GroupTimelogGatewayProvider gateway={groups}>
              <ViewerGatewayProvider gateway={viewer}>{screen}</ViewerGatewayProvider>
            </GroupTimelogGatewayProvider>
          </TimelogGatewayProvider>
        </LocaleProvider>
      </PreferencesProvider>
    </QueryClientProvider>
  )

  const view = render(inProviders(ui))

  return {
    ...view,
    client,
    gateway,
    groups,
    // Overrides the one from Testing Library, which would drop the providers.
    rerender: (next: ReactNode) => {
      view.rerender(inProviders(next))
    },
    viewer,
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
