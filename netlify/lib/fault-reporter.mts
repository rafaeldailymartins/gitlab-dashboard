import type { Transport, TransportRequest } from '@sentry/core'

import {
  createStackParser,
  createTransport,
  dedupeIntegration,
  linkedErrorsIntegration,
  Scope,
} from '@sentry/core'
import { nodeStackLineParser, ServerRuntimeClient } from '@sentry/core/server'

import { scrub } from './scrub.mjs'

export interface FaultReporter {
  capture(error: unknown, tags: Readonly<Record<string, string>>): void
  /** Resolves once what was captured has been sent, or the timeout passed. */
  flush(timeout: number): Promise<boolean>
}

export interface ReporterOptions {
  readonly dsn: string | undefined
  readonly environment: string
  /** Injected in tests; the real one is the platform's. */
  readonly fetch: typeof fetch
  readonly release?: string | undefined
}

/** What every function gets without a project: nothing is sent, nothing is fetched. */
export const SILENT_REPORTER: FaultReporter = {
  capture() {
    // Reporting is not configured on this deploy.
  },
  flush: () => Promise.resolve(true),
}

/**
 * Faults in the functions, sent to the tracker the browser's go to (OBS-2).
 *
 * Built on `@sentry/core`'s server client rather than `@sentry/node`. The Node
 * SDK is an OpenTelemetry instrumentation tree — `import-in-the-middle`,
 * `require-in-the-middle`, a dozen `@opentelemetry/*` packages — whose
 * automatic instrumentation needs a `--import` flag a function cannot pass;
 * errors-only capture would work, but the whole tree would still be installed,
 * which is surface `bun audit` has to keep at zero. The core client has no
 * dependencies, and it is what Sentry's own edge SDKs report with.
 *
 * Every event goes through `scrub`, and the client is told to collect nothing
 * besides — the second layer, not the one the tests prove.
 */
export function faultReporter(options: ReporterOptions): FaultReporter {
  const dsn = options.dsn?.trim() ?? ''

  if (dsn === '') {
    return SILENT_REPORTER
  }

  const client = new ServerRuntimeClient({
    beforeSend: (event) => ({ ...scrub(event), type: undefined }),
    dataCollection: NOTHING,
    dsn,
    environment: options.environment,
    integrations: [dedupeIntegration(), linkedErrorsIntegration()],
    platform: 'node',
    ...(options.release === undefined || options.release === ''
      ? {}
      : { release: options.release }),
    sendClientReports: false,
    stackParser: createStackParser(nodeStackLineParser()),
    transport: (transportOptions) => fetchTransport(transportOptions, options.fetch),
  })

  client.init()

  return {
    capture(error, tags) {
      client.captureException(error, undefined, new Scope().setTags(tags))
    },
    flush: (timeout) => Promise.resolve(client.flush(timeout)),
  }
}

/** Every category the SDK could collect, collected not at all. */
const NOTHING = {
  cookies: false,
  databaseQueryData: false,
  frameContextLines: 0,
  graphQL: { document: false, variables: false },
  httpBodies: [],
  httpHeaders: false,
  queues: false,
  stackFrameVariables: false,
  urlQueryParams: false,
  userInfo: false,
}

function fetchTransport(
  transportOptions: Parameters<typeof createTransport>[0] & { url: string },
  upstream: typeof fetch,
): Transport {
  return createTransport(transportOptions, async (request: TransportRequest) => {
    const body =
      typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body)
    const response = await upstream(transportOptions.url, {
      body,
      headers: { 'content-type': 'application/x-sentry-envelope' },
      method: 'POST',
    })

    return { statusCode: response.status }
  })
}
