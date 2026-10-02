import { isNotFound, isRedirect } from '@tanstack/react-router'

import type { FaultSink, Reporter } from './fault-sink'
import type { ReporterConfig } from './monitoring-sdk'

import { faultSink } from './fault-sink'

/** Where every fault in the page goes, before and after reporting has loaded. */
export const faults = faultSink()

export interface MonitoringOptions {
  readonly config?: ReporterConfig
  /** Fetches the chunk that sends reports, or null when nothing is configured. */
  readonly load?: (() => Promise<{ sentryReporter: (config: ReporterConfig) => Reporter }>) | null
  readonly sink?: FaultSink
  readonly target?: Window
}

const CONFIG: ReporterConfig = {
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
  release: import.meta.env.VITE_SENTRY_RELEASE,
}

/**
 * The reporting chunk, or nothing at all.
 *
 * Decided at build time, on purpose. `vite.config.ts` defines the DSN as a
 * literal, so in a build without one this is `"" === "" ? null : …` and the
 * bundler drops the dynamic import with the branch — the chunk is never
 * emitted, and a build with nothing configured cannot fetch it (OBS-7).
 */
const LOAD = import.meta.env.VITE_SENTRY_DSN === '' ? null : () => import('./monitoring-sdk')

/**
 * A fault a React boundary caught, or one nothing caught.
 *
 * Handed to `createRoot` rather than to the router: the router reports through
 * `defaultOnCatch` only when a route has an error component, and none here does,
 * so its own boundary draws the error and tells nobody. React sees every one of
 * them, loader errors included — a match that failed to load rethrows during
 * render — and reporting from here changes nothing that is drawn (OBS-1).
 *
 * A not-found and a redirect are thrown on purpose, and are not faults.
 */
export function reportRenderFault(error: unknown, sink: FaultSink = faults): void {
  if (!isNotFound(error) && !isRedirect(error)) {
    sink.report(errorOf(error), { origin: 'route' })
  }
}

/**
 * Starts listening for faults now, and fetches what sends them later.
 *
 * The listeners are in the first load so that a fault in the first second is
 * held rather than lost; the SDK is fetched when the page is idle, falling back
 * to the `load` event and never a timer — a timer would race the month's own
 * requests (OBS-5). If the chunk cannot be fetched, what was held is dropped and
 * nothing else happens (OBS-6).
 */
export function startMonitoring({
  config = CONFIG,
  load = LOAD,
  sink = faults,
  target = globalThis.window,
}: MonitoringOptions = {}): void {
  target.addEventListener('error', (event) => {
    // The platform types both of these `any`; what arrives can be anything.
    const thrown: unknown = event.error

    sink.report(errorOf(thrown ?? event.message), { origin: 'global' })
  })
  target.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason

    sink.report(errorOf(reason), { origin: 'global' })
  })

  if (load === null) {
    return
  }

  whenIdle(target, () => {
    load().then(
      ({ sentryReporter }) => {
        sink.install(sentryReporter(config))
      },
      () => {
        sink.abandon()
      },
    )
  })
}

function errorOf(value: unknown): Error {
  return value instanceof Error ? value : new Error('A value that is not an error was thrown')
}

/** Safari shipped `requestIdleCallback` late, whatever the type library says. */
function whenIdle(target: Window, start: () => void): void {
  const scheduler: Partial<Pick<Window, 'requestIdleCallback'>> = target

  if (scheduler.requestIdleCallback === undefined) {
    target.addEventListener('load', start, { once: true })
  } else {
    scheduler.requestIdleCallback(start)
  }
}
