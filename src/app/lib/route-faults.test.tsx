import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { faultSink } from './fault-sink'
import { reportRenderFault } from './monitoring'

/**
 * Route faults, reported from the React root against a real router (OBS-1).
 *
 * The router calls `defaultOnCatch` only beside an error component, and this
 * app has none — its global boundary draws the error and, in production, tells
 * nobody. These prove React's root sees the faults anyway, loader ones
 * included, and that reporting them leaves what is drawn alone.
 */
function openAt(path: string) {
  const root = createRootRoute()
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
    routeTree: root.addChildren([
      createRoute({
        component: () => <p>Loaded</p>,
        getParentRoute: () => root,
        loader: () => {
          throw new TypeError('the loader failed')
        },
        path: '/loader',
      }),
      createRoute({
        component: () => {
          throw new RangeError('the render failed')
        },
        getParentRoute: () => root,
        path: '/render',
      }),
      createRoute({
        component: () => <p>Loaded</p>,
        getParentRoute: () => root,
        loader: () => {
          // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router reads a thrown not-found as a value, which is what this route exercises
          throw notFound()
        },
        path: '/missing',
      }),
    ]),
  })
  const sink = faultSink()
  const report = vi.spyOn(sink, 'report')

  vi.spyOn(console, 'error').mockImplementation(vi.fn())
  vi.spyOn(console, 'warn').mockImplementation(vi.fn())
  render(<RouterProvider router={router} />, {
    onCaughtError: (error) => {
      reportRenderFault(error, sink)
    },
  })

  return { report }
}

describe('a route that fails', () => {
  it.each([
    ['/loader', TypeError],
    ['/render', RangeError],
  ])('at %s is reported once, and draws the error it always drew', async (path, kind) => {
    const { report } = openAt(path)

    expect(await screen.findByText('Something went wrong!')).toBeInTheDocument()
    expect(report).toHaveBeenCalledOnce()
    expect(report.mock.calls[0]?.[0]).toBeInstanceOf(kind)
    expect(report.mock.calls[0]?.[1]).toEqual({ origin: 'route' })
  })

  it('is not reported when it only could not find what it was asked for', async () => {
    const { report } = openAt('/missing')

    expect(await screen.findByText('Not Found')).toBeInTheDocument()
    expect(report).not.toHaveBeenCalled()
  })
})
