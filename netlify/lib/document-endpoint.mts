import type { DocumentStore } from './document-store.mjs'
import type { DocumentKind } from './handle-document.mjs'
import type { Identity, VerifierOptions } from './identity.mjs'

import { blobDocumentStore } from './blob-store.mjs'
import { gitLabConfig } from './gitlab.mjs'
import { handleDocument } from './handle-document.mjs'
import { providerKeys, verifyIdentity } from './identity.mjs'

export interface EndpointOptions {
  readonly document: DocumentKind
  /** Injected in tests; the real one discovers the provider's published keys. */
  readonly keys?: (baseUrl: string) => Promise<Keys | null>
  /** Injected in tests; the real one throws outside a Netlify environment. */
  readonly store?: () => DocumentStore
}

type Keys = VerifierOptions['keys']

/**
 * Everything both document functions do before the handler, and nothing else.
 *
 * `netlify/functions/{teams,preferences}.mts` were the same fifty lines twice,
 * differing in a document and a path. That is the arrangement this change
 * already rejected for the handler itself — two copies are two places to fix a
 * rule, and the second is the one somebody forgets — and the copy here held the
 * least obvious rule of the three: that a **failed** discovery must not be
 * cached. One bad minute would otherwise outlast itself for the whole life of
 * the instance, in whichever of the two files nobody corrected.
 *
 * What is shared is the wiring, not the authority. The key is still derived
 * inside `handle-document.mts` from a subject the signature established, and
 * the `document` each function passes is still a constant that module chooses.
 */
export function documentEndpoint({
  document,
  keys = providerKeys,
  store = blobDocumentStore,
}: EndpointOptions): (request: Request) => Promise<Response> {
  const discovery = keyCache(keys)

  return async (request) => {
    const config = gitLabConfig(process.env)

    if (config === null) {
      return unavailable()
    }

    const discovered = await discovery(config.baseUrl)

    if (discovered === null) {
      return unavailable()
    }

    const options: VerifierOptions = {
      audience: config.clientId,
      issuer: config.baseUrl,
      keys: discovered,
    }

    return handleDocument(request, {
      document,
      store: store(),
      verify: (token): Promise<Identity> => verifyIdentity(token, options),
    })
  }
}

/**
 * The provider's keys, fetched once per cold start and reused after that.
 *
 * Held as the promise rather than its result so that several requests arriving
 * together on a cold instance share one discovery rather than racing four. In
 * the endpoint's own closure rather than in the module, so that constructing an
 * endpoint is the only way to get one — which is what lets a test hold a single
 * endpoint across two requests and see that the failure was not remembered.
 */
function keyCache(
  discover: (baseUrl: string) => Promise<Keys | null>,
): (baseUrl: string) => Promise<Keys | null> {
  let pending: null | Promise<Keys | null> = null

  return (baseUrl) => {
    pending ??= discover(baseUrl).then((keys) => {
      if (keys === null) {
        // A failed discovery must not be cached, or one bad minute would
        // outlast itself for the whole life of the instance.
        pending = null
      }

      return keys
    })

    return pending
  }
}

/** Says only that identity could not be established, never why. */
function unavailable(): Response {
  return Response.json(
    { error: 'identity-unavailable' },
    { headers: { 'cache-control': 'no-store' }, status: 503 },
  )
}
