import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { LocaleProvider } from '@/shared/i18n'

import { NotFoundPage } from './not-found-page'

function openAt(path: string) {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    component: () => <p>Dashboard</p>,
    getParentRoute: () => rootRoute,
    path: '/',
  })
  const router = createRouter({
    defaultNotFoundComponent: NotFoundPage,
    history: createMemoryHistory({ initialEntries: [path] }),
    routeTree: rootRoute.addChildren([indexRoute]),
  })

  render(
    <LocaleProvider>
      <RouterProvider router={router} />
    </LocaleProvider>,
  )

  return router
}

describe('NotFoundPage', () => {
  it('answers an address that names no screen in the reader’s language', async () => {
    openAt('/teams')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      /nothing at this address/i,
    )
    expect(screen.queryByText('Not Found')).not.toBeInTheDocument()
  })

  it('leads back to the dashboard', async () => {
    const router = openAt('/teams')

    await userEvent.click(await screen.findByRole('link', { name: /back to the dashboard/i }))

    expect(router.state.location.pathname).toBe('/')
  })
})
