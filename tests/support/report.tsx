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
import { SessionProvider } from '@/entities/sessions'
import {
  type ColumnProbeAnswer,
  type ColumnProbeQuery,
  type GroupRef,
  type SuggestionAnswer,
  type TeamHoursPage,
  type TeamTimelogGateway,
  TeamTimelogGatewayProvider,
} from '@/entities/team-timelogs'
import {
  type Team,
  type TeamsDocument,
  type TeamsGateway,
  TeamsGatewayProvider,
} from '@/entities/teams'
import { type TimelogGateway, TimelogGatewayProvider, type TimelogPage } from '@/entities/timelogs'
import { type ViewerGateway, ViewerGatewayProvider } from '@/entities/viewers'
import { LocaleProvider } from '@/shared/i18n'
import { type KeyValueStorage, memoryStorage } from '@/shared/lib/storage'

import { fakeSessionManager } from './session'

interface ReportRenderOptions {
  readonly gateway?: TimelogGateway
  readonly storage?: KeyValueStorage
  readonly teams?: TeamsGateway
  readonly timelogs?: TeamTimelogGateway
  readonly viewer?: ViewerGateway
}

interface TeamAnswers {
  /** What the provider declares per column, by the member's identifier. */
  readonly columns?: ReadonlyMap<string, ColumnProbeAnswer>
  /** What one path resolves to. Undefined answers with the squad fixture. */
  readonly group?: GroupRef | null
  readonly groups?: readonly GroupRef[]
  readonly pages?: readonly TeamHoursPage[]
  readonly suggestions?: SuggestionAnswer
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
 * A team-hours gateway that answers with what it is given.
 *
 * The rounds are handed out in order and the last one repeats, so a test that
 * says nothing about continuation gets one round that ends the window.
 */
export function fakeTeamGateway(answers: TeamAnswers = {}) {
  const pages = answers.pages ?? [{ members: [] }]
  let call = 0

  return {
    columns: vi.fn((query: ColumnProbeQuery) =>
      Promise.resolve(
        answers.columns?.get(query.memberId) ?? {
          byColumn: new Map(),
          period: { entryCount: 0, seconds: 0 },
        },
      ),
    ),
    following: vi.fn((): Promise<TeamHoursPage> => Promise.resolve({ members: [] })),
    group: vi.fn(() => Promise.resolve(answers.group === undefined ? SQUAD : answers.group)),
    groups: vi.fn(() => Promise.resolve(answers.groups ?? [SQUAD])),
    people: vi.fn(() => Promise.resolve([])),
    suggestions: vi.fn(() =>
      Promise.resolve(answers.suggestions ?? { partial: false, people: [] }),
    ),
    timelogs: vi.fn((): Promise<TeamHoursPage> => {
      const page = pages[Math.min(call, pages.length - 1)]

      call += 1

      return Promise.resolve(page ?? { members: [] })
    }),
  } satisfies TeamTimelogGateway
}

/**
 * A teams store that answers from memory.
 *
 * The version is a counter rather than a hash: what the screen does with it is
 * hand it back on the next write, and a counter makes a stale one obvious in a
 * failure message.
 */
export function fakeTeamsGateway(initial: readonly Team[] = []) {
  let document: TeamsDocument = { etag: '"1"', teams: initial }
  let version = 1

  return {
    read: vi.fn(() => Promise.resolve(document)),
    write: vi.fn((next: TeamsDocument) => {
      version += 1
      document = { etag: `"${String(version)}"`, teams: next.teams }

      return Promise.resolve(document)
    }),
  } satisfies TeamsGateway
}

/** The group every group fixture is about, unless a test says otherwise. */
export const SQUAD: GroupRef = {
  fullPath: 'acme/squad-fiscal',
  id: 'gid://gitlab/Group/64237110',
  name: 'squad-fiscal',
}

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
  const timelogs = options.timelogs ?? fakeTeamGateway()
  const teams = options.teams ?? fakeTeamsGateway()
  // Signed in, as every screen that reads hours is. A surface that offers to
  // authorise again needs the session, and a test can read what it was asked.
  const session = fakeSessionManager({ hasSession: vi.fn(() => true) })
  const navigateAway = vi.fn<(url: string) => void>()

  const inProviders = (screen: ReactNode) => (
    <QueryClientProvider client={client}>
      <PreferencesProvider store={store}>
        <LocaleProvider>
          <SessionProvider manager={session} navigateAway={navigateAway}>
            <TimelogGatewayProvider gateway={gateway}>
              <TeamsGatewayProvider gateway={teams}>
                <TeamTimelogGatewayProvider gateway={timelogs}>
                  <ViewerGatewayProvider gateway={viewer}>{screen}</ViewerGatewayProvider>
                </TeamTimelogGatewayProvider>
              </TeamsGatewayProvider>
            </TimelogGatewayProvider>
          </SessionProvider>
        </LocaleProvider>
      </PreferencesProvider>
    </QueryClientProvider>
  )

  const view = render(inProviders(ui))

  return {
    ...view,
    client,
    gateway,
    navigateAway,
    // Overrides the one from Testing Library, which would drop the providers.
    rerender: (next: ReactNode) => {
      view.rerender(inProviders(next))
    },
    session,
    teams,
    timelogs,
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
