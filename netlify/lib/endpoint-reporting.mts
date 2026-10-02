import type { EndpointFault } from './endpoint-fault.mjs'
import type { FaultReporter } from './fault-reporter.mjs'

import { type Environment, environmentFor } from './deploy-environment.mjs'
import { faultReporter } from './fault-reporter.mjs'
import { RELEASE } from './release.mjs'

/**
 * The part of what the platform hands a function that an endpoint reads.
 *
 * Structural rather than the platform's own `Context`, so that the development
 * middleware and the tests can say which deploy they stand for without faking
 * the rest of it. Every field is optional because a deploy that leaves them out
 * is exactly the case `storeNameFor` refuses.
 */
export interface Invocation {
  readonly deploy?: { readonly context?: unknown }
  /** Keeps the instance alive for work that should not hold up the answer. */
  readonly waitUntil?: (promise: Promise<unknown>) => void
}

export type Report = (fault: EndpointFault) => void

export interface ReportingOptions {
  /** Which document the endpoint serves, as a report names it. */
  readonly document: string
  readonly reporter: (environment: Environment) => FaultReporter
}

type Serve = (request: Request, invocation: Invocation, report: Report) => Promise<Response>

/** How long a fault may keep an instance alive while it is sent. */
const FLUSH_TIMEOUT = 2000

/** The reporter every deployed endpoint uses: the project the bundle reports to. */
export function deployedReporter(environment: Environment): FaultReporter {
  return faultReporter({
    dsn: process.env['VITE_SENTRY_DSN'],
    environment,
    fetch: (input, init) => fetch(input, init),
    release: RELEASE,
  })
}

/**
 * An endpoint that tells the tracker about its faults, and answers exactly as it
 * would have otherwise (OBS-2).
 *
 * `serve` is handed a `report` for every `503` it gives. An exception it throws
 * is reported and thrown again, so the platform's answer to it is what it always
 * was. The reporter is built once, on the first request — the deploy is known
 * only from the invocation, and it does not change while an instance lives.
 *
 * Sending never holds up the reader when the platform offers `waitUntil`: the
 * answer goes out and the flush finishes behind it. Where it does not, the flush
 * is awaited for at most two seconds, and only after a fault, so a request that
 * went well costs nothing at all.
 */
export function withReporting(
  serve: Serve,
  options: ReportingOptions,
): (request: Request, invocation: Invocation) => Promise<Response> {
  let reporter: FaultReporter | null = null

  return async (request, invocation) => {
    reporter ??= options.reporter(environmentFor(invocation.deploy?.context))

    const active = reporter
    const outcome = { reported: false }
    const capture = (error: unknown, tags: Readonly<Record<string, string>>): void => {
      outcome.reported = true
      active.capture(error, { document: options.document, origin: 'endpoint', ...tags })
    }

    try {
      return await serve(request, invocation, (fault) => {
        capture(fault, { reason: fault.reason })
      })
    } catch (error) {
      capture(error, {})

      throw error
    } finally {
      if (outcome.reported) {
        await settle(active, invocation)
      }
    }
  }
}

async function settle(reporter: FaultReporter, invocation: Invocation): Promise<void> {
  const flushing = reporter.flush(FLUSH_TIMEOUT).catch(() => false)

  if (invocation.waitUntil === undefined) {
    await flushing
  } else {
    invocation.waitUntil(flushing)
  }
}
