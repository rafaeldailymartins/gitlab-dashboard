import { notFound, redirect } from '@tanstack/react-router'
import { describe, expect, it, vi } from 'vitest'

import type { Reporter } from './fault-sink'

import { faultSink } from './fault-sink'
import { reportRenderFault, startMonitoring } from './monitoring'

const CONFIG = {
  dsn: 'https://public@o1.ingest.de.sentry.io/42',
  environment: 'test',
  release: 'r',
}

/** A window with nothing in it but events and, optionally, an idle callback. */
function fakeWindow(idle: boolean) {
  const target = new EventTarget() as EventTarget & {
    requestIdleCallback?: (run: () => void) => void
  }
  const pending: (() => void)[] = []

  if (idle) {
    target.requestIdleCallback = (run) => pending.push(run)
  }

  return {
    idle: () => {
      for (const run of pending.splice(0)) {
        run()
      }
    },
    target: target as unknown as Window,
  }
}

function loader(reporter: Reporter) {
  return vi.fn(() => Promise.resolve({ sentryReporter: () => reporter }))
}

describe('startMonitoring', () => {
  it('holds a fault from before the reporting code arrived, and sends it once it does (OBS-5)', async () => {
    const { idle, target } = fakeWindow(true)
    const reporter = vi.fn<Reporter>()
    const load = loader(reporter)
    const fault = new Error('early')

    startMonitoring({ config: CONFIG, load, sink: faultSink(), target })
    target.dispatchEvent(new ErrorEvent('error', { error: fault }))

    expect(load).not.toHaveBeenCalled()

    idle()
    await vi.waitFor(() => {
      expect(reporter).toHaveBeenCalledWith(fault, { origin: 'global' })
    })
  })

  it('fetches nothing when nothing is configured (OBS-7)', () => {
    const { idle, target } = fakeWindow(true)
    const sink = faultSink()
    const install = vi.spyOn(sink, 'install')

    startMonitoring({ config: CONFIG, load: null, sink, target })
    idle()

    expect(install).not.toHaveBeenCalled()
  })

  it('waits for the page to finish loading where there is no idle callback, and never for a timer', async () => {
    const { target } = fakeWindow(false)
    const load = loader(vi.fn<Reporter>())

    startMonitoring({ config: CONFIG, load, sink: faultSink(), target })

    expect(load).not.toHaveBeenCalled()

    target.dispatchEvent(new Event('load'))
    await vi.waitFor(() => {
      expect(load).toHaveBeenCalledOnce()
    })
  })

  it('drops what it held, silently, when the reporting code cannot be fetched (OBS-6)', async () => {
    const { idle, target } = fakeWindow(true)
    const sink = faultSink()
    const abandon = vi.spyOn(sink, 'abandon')

    startMonitoring({
      config: CONFIG,
      load: () => Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
      sink,
      target,
    })
    idle()

    await vi.waitFor(() => {
      expect(abandon).toHaveBeenCalledOnce()
    })
  })

  it('reports a rejection nothing handled, wrapping one that is not an error', () => {
    const { target } = fakeWindow(true)
    const sink = faultSink()
    const report = vi.spyOn(sink, 'report')
    const rejection = new Event('unhandledrejection') as Event & { reason: unknown }

    rejection.reason = { username: 'ada' }
    startMonitoring({ config: CONFIG, load: null, sink, target })
    target.dispatchEvent(rejection)

    const [error, tags] = report.mock.calls[0] ?? []

    expect(error).toBeInstanceOf(Error)
    expect(error?.message).not.toContain('ada')
    expect(tags).toEqual({ origin: 'global' })
  })

  it('reports an error event that carries only a message', () => {
    const { target } = fakeWindow(true)
    const sink = faultSink()
    const report = vi.spyOn(sink, 'report')

    startMonitoring({ config: CONFIG, load: null, sink, target })
    target.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }))

    expect(report).toHaveBeenCalledOnce()
  })
})

describe('reportRenderFault', () => {
  it('reports an error a boundary caught', () => {
    const sink = faultSink()
    const report = vi.spyOn(sink, 'report')
    const error = new TypeError("Cannot read properties of undefined (reading 'name')")

    reportRenderFault(error, sink)

    expect(report).toHaveBeenCalledWith(error, { origin: 'route' })
  })

  it('reports nothing for a not-found or a redirect, which are thrown on purpose', () => {
    const sink = faultSink()
    const report = vi.spyOn(sink, 'report')

    reportRenderFault(notFound(), sink)
    reportRenderFault(redirect({ to: '/' }), sink)

    expect(report).not.toHaveBeenCalled()
  })
})
