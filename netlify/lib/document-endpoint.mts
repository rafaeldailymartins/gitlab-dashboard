import type { Environment } from './deploy-environment.mjs'
import type { DocumentStore } from './document-store.mjs'
import type { Invocation, Report } from './endpoint-reporting.mjs'
import type { FaultReporter } from './fault-reporter.mjs'
import type { DocumentKind } from './handle-document.mjs'
import type { Identity, VerifierOptions } from './identity.mjs'
import type { StoreName } from './store-name.mjs'

import { blobDocumentStore } from './blob-store.mjs'
import { EndpointFault } from './endpoint-fault.mjs'
import { deployedReporter, withReporting } from './endpoint-reporting.mjs'
import { gitLabConfig } from './gitlab.mjs'
import { handleDocument } from './handle-document.mjs'
import { providerKeys, verifyIdentity } from './identity.mjs'
import { storeNameFor } from './store-name.mjs'

export interface EndpointOptions {
  readonly document: DocumentKind
  /** Injected in tests; the real one discovers the provider's published keys. */
  readonly keys?: (baseUrl: string) => Promise<Keys | null>
  /** Injected in tests; the real one reports to the project the bundle reports to. */
  readonly reporter?: (environment: Environment) => FaultReporter
  /** Injected in tests; the real one throws outside a Netlify environment. */
  readonly store?: (name: StoreName) => DocumentStore
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
 *
 * **Which store comes first**, before the configuration and before any key is
 * fetched (DELIVERY-1). It is a fact about the deploy, not about the caller, and
 * a deploy that cannot say which it is gets nothing from any store at all.
 */
export function documentEndpoint({
  document,
  keys = providerKeys,
  reporter = deployedReporter,
  store = blobDocumentStore,
}: EndpointOptions): (request: Request, invocation: Invocation) => Promise<Response> {
  const discovery = keyCache(keys)
  const serve = async (request: Request, invocation: Invocation, report: Report) => {
    const name = storeNameFor(invocation.deploy?.context)

    if (name === null) {
      return storeUnavailable(report)
    }

    const config = gitLabConfig(process.env)

    if (config === null) {
      return unavailable(report)
    }

    const discovered = await discovery(config.baseUrl)

    if (discovered === null) {
      return unavailable(report)
    }

    const options: VerifierOptions = {
      audience: config.clientId,
      issuer: config.baseUrl,
      keys: discovered,
    }

    return handleDocument(request, {
      document,
      report,
      store: store(name),
      verify: (token): Promise<Identity> => verifyIdentity(token, options),
    })
  }

  // The suffix is a constant the function module chose, so the name a report
  // gives the document is one too: `teams` or `preferences`.
  return withReporting(serve, { document: document.suffix.slice(1), reporter })
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

/**
 * Says that no store may be asked on this deploy.
 *
 * The same status as a provider that cannot be reached, because to a reader it
 * is the same thing — the teams cannot be read right now — and the browser
 * already says that for a `503`. A different word in the body, because to
 * whoever reads the log it is nothing to do with identity.
 */
function storeUnavailable(report: Report): Response {
  report(new EndpointFault('store-unavailable'))

  return Response.json(
    { error: 'store-unavailable' },
    { headers: { 'cache-control': 'no-store' }, status: 503 },
  )
}

/** Says only that identity could not be established, never why. */
function unavailable(report: Report): Response {
  report(new EndpointFault('identity-unavailable'))

  return Response.json(
    { error: 'identity-unavailable' },
    { headers: { 'cache-control': 'no-store' }, status: 503 },
  )
}
