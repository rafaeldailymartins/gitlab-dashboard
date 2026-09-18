import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~tests/support/render'
import { stubSystemDarkMode } from '~tests/support/system-dark-mode'

import { SettingsPage } from './settings-page'

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * The screen inside a router, because it links to the teams screen.
 *
 * A real router over an in-memory history rather than a mocked `useNavigate`:
 * what a test wants to know is which address a link leads to, and the router's
 * own resolution is the only honest answer.
 */
function renderSettings() {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    component: () => <SettingsPage />,
    getParentRoute: () => rootRoute,
    path: '/',
  })
  const teamsRoute = createRoute({
    component: () => <p>Teams screen</p>,
    getParentRoute: () => rootRoute,
    path: '/teams',
  })
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute.addChildren([indexRoute, teamsRoute]),
  })

  return renderWithProviders(<RouterProvider router={router} />)
}

describe('SettingsPage', () => {
  it('is titled, with one heading for the page', async () => {
    stubSystemDarkMode(false)
    renderSettings()

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Settings')
  })

  it('groups the schedule settings together', async () => {
    stubSystemDarkMode(false)
    renderSettings()

    expect(await screen.findByText('Working schedule')).toBeInTheDocument()
    expect(screen.getAllByRole('spinbutton')).toHaveLength(7)
    expect(screen.getByLabelText('Time zone')).toBeInTheDocument()
  })

  it('offers the way to the teams screen, rather than a fifth navigation link', async () => {
    stubSystemDarkMode(false)
    renderSettings()

    expect(await screen.findByRole('link', { name: /manage teams/i })).toHaveAttribute(
      'href',
      '/teams',
    )
  })

  it('groups the appearance settings together', async () => {
    stubSystemDarkMode(false)
    renderSettings()

    expect(await screen.findByText('Appearance')).toBeInTheDocument()
    expect(screen.getByLabelText('Language')).toBeInTheDocument()
    expect(screen.getByLabelText('Colour scheme')).toBeInTheDocument()
  })

  it('renders every setting in the chosen language', async () => {
    stubSystemDarkMode(false)
    renderSettings()

    await userEvent.selectOptions(await screen.findByLabelText('Language'), 'pt-BR')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Configurações')
    expect(screen.getByText('Jornada de trabalho')).toBeInTheDocument()
    expect(screen.getByLabelText('Fuso horário')).toBeInTheDocument()
  })
})
