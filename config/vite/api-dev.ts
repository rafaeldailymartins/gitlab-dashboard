import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

import type { DocumentKind } from '../../netlify/lib/handle-document.mjs'

import { documentEndpoint } from '../../netlify/lib/document-endpoint.mjs'
import { memoryDocumentStore } from '../../netlify/lib/document-store.mjs'
import { SILENT_REPORTER } from '../../netlify/lib/fault-reporter.mjs'
import { PREFERENCES_DOCUMENT } from '../../netlify/lib/preferences-document.mjs'
import { TEAMS_DOCUMENT } from '../../netlify/lib/teams-document.mjs'

/** Every endpoint this app serves, and the document each one keeps. */
const ENDPOINTS: readonly { document: DocumentKind; path: string }[] = [
  { document: PREFERENCES_DOCUMENT, path: '/.netlify/functions/preferences' },
  { document: TEAMS_DOCUMENT, path: '/.netlify/functions/teams' },
]

/**
 * The deploy this middleware stands for: a local run, which the endpoint files
 * under homologation's store. The memory store below ignores the name, so what
 * this decides is only that a development request never looks like production's.
 */
const DEVELOPMENT = { deploy: { context: 'dev' } }

interface Exchange {
  /** The deployed function's own body, with a memory store behind it. */
  readonly endpoint: ReturnType<typeof documentEndpoint>
  readonly incoming: IncomingMessage
  readonly outgoing: ServerResponse
  /** The address this endpoint is served at, not the key its document is kept under. */
  readonly path: string
}

/**
 * The document endpoints, during `bun run dev`.
 *
 * A few dozen lines rather than a dependency. Netlify's own Vite plugin would
 * emulate the whole platform, and it brings a large tree with it — `README.md`
 * records this project rejecting `@lhci/cli` for exactly that, because
 * `bun audit` must report zero at any severity and a tool's dependencies count.
 * The endpoint is a `(Request) => Response`, which is all a Vite middleware
 * needs, so the emulator would be buying something already in hand.
 *
 * **This runs the deployed function's own body**, out of `document-endpoint.mts`,
 * with the memory store passed in. It used to read the configuration and
 * discover the provider's keys itself, which made it a third copy of the same
 * thirty lines — and a worse one, because it discovered on every request rather
 * than once. What is left here is the translation between what Vite hands a
 * middleware and what a function is called with, which is the only part of this
 * that is about development at all.
 *
 * The identity check is the real one, against the real provider's keys: a
 * development endpoint that accepted anything would be the one place this
 * feature is easiest to get wrong and hardest to notice.
 *
 * **One store, shared by both endpoints, exactly as the deployed one is.** They
 * write different keys under it, and a middleware that handed each its own map
 * would hide the one mistake this arrangement can make — a suffix that is not
 * distinct, so two documents overwrite each other.
 *
 * The store is in memory, so a restart forgets. That is a feature here — there
 * is no local state to clean up between experiments, and nothing on the disk of
 * whoever is developing. It also means nothing here touches the deployed site's
 * blobs: the only production thing a development request reaches is the
 * provider's public key set.
 */
export function apiDevEndpoints(): Plugin {
  const store = memoryDocumentStore()

  return {
    apply: 'serve',
    configureServer(server) {
      for (const { document, path } of ENDPOINTS) {
        // A local run reports nothing, whatever `.env` holds: a developer's
        // broken store is not a fault in anybody's deploy.
        const endpoint = documentEndpoint({
          document,
          reporter: () => SILENT_REPORTER,
          store: () => store,
        })

        server.middlewares.use(path, (request, response, next) => {
          void respond({ endpoint, incoming: request, outgoing: response, path }).catch(next)
        })
      }
    },
    name: 'api-dev-endpoints',
  }
}

/** The request Vite handed us, as the one the handler takes. */
async function asRequest(incoming: IncomingMessage, path: string): Promise<Request> {
  const headers = new Headers()

  for (const [name, value] of Object.entries(incoming.headers)) {
    if (typeof value === 'string') {
      headers.set(name, value)
    }
  }

  const method = incoming.method ?? 'GET'
  const url = `http://localhost${path}`

  return method === 'GET' || method === 'HEAD'
    ? new Request(url, { headers, method })
    : new Request(url, { body: await bodyOf(incoming), headers, method })
}

async function bodyOf(incoming: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []

  for await (const chunk of incoming) {
    chunks.push(chunk as Buffer)
  }

  return Buffer.concat(chunks).toString('utf8')
}

async function respond({ endpoint, incoming, outgoing, path }: Exchange): Promise<void> {
  const answer = await endpoint(await asRequest(incoming, path), DEVELOPMENT)

  outgoing.writeHead(answer.status, Object.fromEntries(answer.headers))
  outgoing.end(await answer.text())
}
