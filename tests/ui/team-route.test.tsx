import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ANA, member } from '~tests/support/gitlab-team-timelogs'
import { fakeTeamGateway, fakeTeamsGateway, renderReport } from '~tests/support/report'

import type { TeamTimelogGateway } from '@/entities/team-timelogs'
import type { Team, TeamsGateway } from '@/entities/teams'

import { Route } from '@/app/routes/_authenticated.team'

/*
 * The team route's own memory, driven through the real module: `beforeLoad`
 * completing a bare address, the page recognising what it was completed with,
 * and the navigation that remembers — or forgets. Only the runtime and the two
 * gateway factories the route builds are replaced, because they reach the
 * network.
 */

const fakes = vi.hoisted(() => ({
  teams: undefined as TeamsGateway | undefined,
  timelogs: undefined as TeamTimelogGateway | undefined,
}))

vi.mock('@/app/lib/runtime', () => ({ apiClient: () => ({}), sessionManager: () => ({}) }))
vi.mock('@/entities/teams', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/teams')>()),
  httpTeamsGateway: () => fakes.teams,
}))
vi.mock('@/entities/team-timelogs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/team-timelogs')>()),
  gitLabTeamTimelogGateway: () => fakes.timelogs,
}))

const KEY = 'team-report-team'
const GONE = '018f3b2c-7a41-7c9e-9f2d-000000000000'
const KEPT: Team = {
  id: '018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d70',
  members: [member(ANA)],
  name: 'Squad Fiscal',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

function arrive(address: string) {
  const teams = fakeTeamsGateway([KEPT])
  const timelogs = fakeTeamGateway()

  fakes.teams = teams
  fakes.timelogs = timelogs

  const root = createRootRoute()
  const layout = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  // The file route, attached under a stand-in for the layout it lives in.
  const team = Route.update({ getParentRoute: () => layout, id: '/team', path: '/team' } as never)
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [address] }),
    routeTree: root.addChildren([layout.addChildren([team])]),
  })

  renderReport(<RouterProvider router={router} />, { teams, timelogs })

  return router
}

afterEach(() => {
  localStorage.clear()
})

describe('the team route', () => {
  // GROUP-20: the team this reader chose last was deleted from Settings, or on
  // another device, and the bare address used to redirect into it on every visit.
  it('forgets a remembered team that no longer exists, and does not come back to it', async () => {
    localStorage.setItem(KEY, GONE)

    const router = arrive('/team')

    await waitFor(() => {
      expect(localStorage.getItem(KEY)).not.toBe(GONE)
    })
    expect(router.state.location.search).not.toMatchObject({ team: GONE })
    // The picker is `lazy()`, and under coverage instrumentation its chunk takes
    // longer than Testing Library's one-second default to arrive.
    const picker = await screen.findByRole('combobox', { name: /^team$/i }, { timeout: 8000 })

    expect(picker).toHaveTextContent(KEPT.name)
    expect(screen.queryByText(/not one of yours/i)).not.toBeInTheDocument()

    await router.navigate({ search: {}, to: '/team' } as never)

    expect(router.state.location.search).not.toMatchObject({ team: GONE })
  }, 20_000)

  // GROUP-14: nothing remembered, so the address came from somebody else.
  it('still says so when a sent link names a team that is not the reader’s', async () => {
    const router = arrive(`/team?team=${GONE}`)

    expect(await screen.findByText(/not one of yours/i)).toBeInTheDocument()
    expect(router.state.location.search).toMatchObject({ team: GONE })
  }, 20_000)
})
