import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DocumentStore } from './document-store.mjs'
import type { VerifierOptions } from './identity.mjs'
import type { StoreName } from './store-name.mjs'

import { documentEndpoint } from './document-endpoint.mjs'
import { memoryDocumentStore } from './document-store.mjs'
import { TEAMS_DOCUMENT } from './teams-document.mjs'

/**
 * The wiring both document functions are, with the platform outside.
 *
 * Nothing about a credential is decided here — `handle-document.test.mts` holds
 * all of that. What this covers is the ways an endpoint can answer before the
 * handler is reached at all, and the one of them that used to be a copy in two
 * files: a discovery that failed must not be remembered.
 */

type Discover = (baseUrl: string) => Promise<null | VerifierOptions['keys']>

/** Stands in for a resolved key set; nothing here ever verifies with it. */
const KEYS = Symbol('a resolved key set') as unknown as VerifierOptions['keys']

let store: ReturnType<typeof memoryDocumentStore>

beforeEach(() => {
  store = memoryDocumentStore()
  vi.stubEnv('VITE_GITLAB_CLIENT_ID', 'app-1')
  vi.stubEnv('VITE_GITLAB_BASE_URL', 'https://gitlab.example')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function asked(): Request {
  return new Request('https://app.example/.netlify/functions/teams')
}

/** What the platform hands a function on a production deploy. */
const PRODUCTION = { deploy: { context: 'production' } }

function endpointWith(keys: Discover): (request: Request) => Promise<Response> {
  const endpoint = documentEndpoint({ document: TEAMS_DOCUMENT, keys, store: () => store })

  return (request) => endpoint(request, PRODUCTION)
}

/** An endpoint that records which store each request was filed under. */
function recordingEndpoint(): {
  endpoint: ReturnType<typeof documentEndpoint>
  named: StoreName[]
} {
  const named: StoreName[] = []
  const factory = (name: StoreName): DocumentStore => {
    named.push(name)

    return store
  }

  return {
    endpoint: documentEndpoint({
      document: TEAMS_DOCUMENT,
      keys: () => Promise.resolve(KEYS),
      store: factory,
    }),
    named,
  }
}

/*
 * DELIVERY-1. The platform says which deploy a function belongs to, and that is
 * the only thing the store's name is taken from. Nothing is asked of a store for
 * a deploy that cannot say what it is — not even a read.
 */
describe('the store a request is filed under', () => {
  it("files production's requests under production's store", async () => {
    const { endpoint, named } = recordingEndpoint()

    await endpoint(asked(), PRODUCTION)

    expect(named).toEqual(['readers'])
  })

  it.each(['branch-deploy', 'deploy-preview'])(
    "files a %s's requests under homologation's",
    async (context) => {
      const { endpoint, named } = recordingEndpoint()

      await endpoint(asked(), { deploy: { context } })

      expect(named).toEqual(['readers-staging'])
    },
  )

  it.each([{}, { deploy: {} }, { deploy: { context: 'staging' } }])(
    'refuses a deploy that cannot say what it is, asking no store: %j',
    async (invocation) => {
      const { endpoint, named } = recordingEndpoint()

      const response = await endpoint(asked(), invocation)

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toEqual({ error: 'store-unavailable' })
      expect(named).toEqual([])
    },
  )
})

describe('before the handler is reached', () => {
  it('says identity is unavailable when the build has no application id', async () => {
    vi.stubEnv('VITE_GITLAB_CLIENT_ID', '')

    const response = await endpointWith(() => Promise.resolve(KEYS))(asked())

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'identity-unavailable' })
  })

  it('says the same when the provider will not say what its keys are', async () => {
    const response = await endpointWith(() => Promise.resolve(null))(asked())

    expect(response.status).toBe(503)
  })

  /*
   * The rule that was a copy in two files, and the one worth a test. Cached, one
   * bad minute would outlast itself for the whole life of the instance: every
   * request after it answered 503 by a remembered promise nobody could retry.
   */
  it('asks again after a discovery that failed, rather than caching the failure', async () => {
    const keys = vi.fn<Discover>().mockResolvedValueOnce(null).mockResolvedValue(KEYS)
    const endpoint = endpointWith(keys)
    const first = await endpoint(asked())

    expect(first.status).toBe(503)

    // The second request reaches the handler, which refuses it for want of a
    // credential — which is the point: refused by the handler, not by a
    // remembered failure.
    const second = await endpoint(asked())

    expect(second.status).toBe(401)
    expect(keys).toHaveBeenCalledTimes(2)
  })

  it('discovers once for a burst that arrives together', async () => {
    const keys = vi.fn<Discover>().mockResolvedValue(KEYS)
    const endpoint = endpointWith(keys)

    await Promise.all([endpoint(asked()), endpoint(asked()), endpoint(asked())])

    expect(keys).toHaveBeenCalledTimes(1)
  })
})
