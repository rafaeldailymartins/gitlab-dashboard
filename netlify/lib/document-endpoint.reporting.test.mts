import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DocumentStore } from './document-store.mjs'
import type { FaultReporter } from './fault-reporter.mjs'
import type { VerifierOptions } from './identity.mjs'

import { documentEndpoint } from './document-endpoint.mjs'
import { memoryDocumentStore } from './document-store.mjs'
import { PREFERENCES_DOCUMENT } from './preferences-document.mjs'
import { TEAMS_DOCUMENT } from './teams-document.mjs'

/**
 * The faults an endpoint reports before the handler is reached, and how the
 * report leaves without holding up the answer (OBS-2).
 */
const KEYS = Symbol('a resolved key set') as unknown as VerifierOptions['keys']
const ADDRESS = 'https://app.example/.netlify/functions/teams'

beforeEach(() => {
  vi.stubEnv('VITE_GITLAB_CLIENT_ID', 'app-1')
  vi.stubEnv('VITE_GITLAB_BASE_URL', 'https://gitlab.example')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function endpoint(
  reporter: (environment: string) => FaultReporter,
  overrides: { keys?: () => Promise<null | VerifierOptions['keys']>; store?: DocumentStore } = {},
) {
  return documentEndpoint({
    document: TEAMS_DOCUMENT,
    keys: overrides.keys ?? (() => Promise.resolve(KEYS)),
    reporter,
    store: () => overrides.store ?? memoryDocumentStore(),
  })
}

function recordingReporter() {
  const captured: { error: unknown; tags: Readonly<Record<string, string>> }[] = []
  const flush = vi.fn(() => Promise.resolve(true))
  const environments: string[] = []
  const reporter = (environment: string): FaultReporter => {
    environments.push(environment)

    return {
      capture: (error, tags) => {
        captured.push({ error, tags })
      },
      flush,
    }
  }

  return { captured, environments, flush, reporter }
}

const PRODUCTION = { deploy: { context: 'production' } }

/** A tracker that takes every fault and never manages to send one. */
function unreachableReporter(): FaultReporter {
  return { capture: vi.fn(), flush: () => Promise.reject(new Error('the tracker is down')) }
}

describe('the faults an endpoint reports before its handler', () => {
  it('reports a deploy that cannot say what it is, naming the document', async () => {
    const { captured, reporter } = recordingReporter()

    const response = await endpoint(reporter)(new Request(ADDRESS), {})

    expect(response.status).toBe(503)
    expect(captured.map(({ tags }) => tags)).toEqual([
      { document: 'teams', origin: 'endpoint', reason: 'store-unavailable' },
    ])
  })

  it('reports a configuration with no application, and a provider whose keys cannot be found', async () => {
    const missing = recordingReporter()
    const undiscoverable = recordingReporter()

    vi.stubEnv('VITE_GITLAB_CLIENT_ID', '')
    await endpoint(missing.reporter)(new Request(ADDRESS), PRODUCTION)
    vi.stubEnv('VITE_GITLAB_CLIENT_ID', 'app-1')
    await endpoint(undiscoverable.reporter, { keys: () => Promise.resolve(null) })(
      new Request(ADDRESS),
      PRODUCTION,
    )

    expect(missing.captured[0]?.tags['reason']).toBe('identity-unavailable')
    expect(undiscoverable.captured[0]?.tags['reason']).toBe('identity-unavailable')
  })

  it('names the document the function serves', async () => {
    const { captured, reporter } = recordingReporter()
    const preferences = documentEndpoint({ document: PREFERENCES_DOCUMENT, reporter })

    await preferences(new Request(ADDRESS), {})

    expect(captured[0]?.tags['document']).toBe('preferences')
  })

  it('reports an exception and throws it again, so the platform answers as it always did', async () => {
    const { captured, reporter } = recordingReporter()
    const failure = new TypeError('the store module exploded')
    const verified = documentEndpoint({
      document: TEAMS_DOCUMENT,
      keys: () => Promise.resolve(KEYS),
      reporter,
      store: () => {
        throw failure
      },
    })

    await expect(verified(new Request(ADDRESS), PRODUCTION)).rejects.toBe(failure)
    expect(captured).toEqual([{ error: failure, tags: { document: 'teams', origin: 'endpoint' } }])
  })

  it('builds its reporter once, for the deploy it is on', async () => {
    const { environments, reporter } = recordingReporter()
    const serve = endpoint(reporter)

    await serve(new Request(ADDRESS), { deploy: { context: 'branch-deploy' } })
    await serve(new Request(ADDRESS), { deploy: { context: 'branch-deploy' } })

    expect(environments).toEqual(['staging'])
  })
})

describe('how a report leaves', () => {
  it('hands the send to the platform when it can, so the answer is not held up', async () => {
    const { flush, reporter } = recordingReporter()
    const waitUntil = vi.fn()

    await endpoint(reporter)(new Request(ADDRESS), { waitUntil })

    expect(waitUntil).toHaveBeenCalledOnce()
    expect(flush).toHaveBeenCalledWith(2000)
  })

  it('waits for the send where the platform offers nothing to hand it to', async () => {
    const { flush, reporter } = recordingReporter()

    await endpoint(reporter)(new Request(ADDRESS), {})

    expect(flush).toHaveBeenCalledOnce()
  })

  it('sends nothing, and waits for nothing, after a request that went well', async () => {
    const { captured, flush, reporter } = recordingReporter()
    const waitUntil = vi.fn()

    const response = await endpoint(reporter)(new Request(ADDRESS), { ...PRODUCTION, waitUntil })

    expect(response.status).toBe(401)
    expect(captured).toEqual([])
    expect(flush).not.toHaveBeenCalled()
    expect(waitUntil).not.toHaveBeenCalled()
  })

  it('answers the same when the tracker cannot be reached', async () => {
    const response = await endpoint(unreachableReporter)(new Request(ADDRESS), {})

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'store-unavailable' })
  })
})
