import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

import { gitLabConfig } from '../../netlify/lib/gitlab.mjs'
import { handleTeams } from '../../netlify/lib/handle-teams.mjs'
import { providerKeys, verifyIdentity } from '../../netlify/lib/identity.mjs'
import { memoryTeamStore } from '../../netlify/lib/team-store.mjs'

const ENDPOINT = '/.netlify/functions/teams'

/**
 * The teams endpoint, during `bun run dev`.
 *
 * Thirty lines rather than a dependency. Netlify's own Vite plugin would
 * emulate the whole platform, and it brings a large tree with it — `README.md`
 * records this project rejecting `@lhci/cli` for exactly that, because
 * `bun audit` must report zero at any severity and a tool's dependencies count.
 * The handler is a `(Request) => Response`, which is all a Vite middleware
 * needs, so the emulator would be buying something already in hand.
 *
 * The identity check is the real one, against the real provider's keys: a
 * development endpoint that accepted anything would be the one place this
 * feature is easiest to get wrong and hardest to notice.
 *
 * The store is in memory, so a restart forgets. That is a feature here — there
 * is no local state to clean up between experiments, and nothing on the disk of
 * whoever is developing.
 */
export function teamsDevEndpoint(): Plugin {
  const store = memoryTeamStore()

  return {
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(ENDPOINT, (request, response, next) => {
        void respond(request, response, store).catch(next)
      })
    },
    name: 'teams-dev-endpoint',
  }
}

/** The request Vite handed us, as the one the handler takes. */
async function asRequest(incoming: IncomingMessage): Promise<Request> {
  const headers = new Headers()

  for (const [name, value] of Object.entries(incoming.headers)) {
    if (typeof value === 'string') {
      headers.set(name, value)
    }
  }

  const method = incoming.method ?? 'GET'
  const url = `http://localhost${ENDPOINT}`

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

async function respond(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
  store: ReturnType<typeof memoryTeamStore>,
): Promise<void> {
  const config = gitLabConfig(process.env)
  const keys = config === null ? null : await providerKeys(config.baseUrl)

  if (config === null || keys === null) {
    outgoing.writeHead(503, { 'content-type': 'application/json' })
    outgoing.end(JSON.stringify({ error: 'identity-unavailable' }))

    return
  }

  const answer = await handleTeams(await asRequest(incoming), {
    store,
    verify: (token) =>
      verifyIdentity(token, { audience: config.clientId, issuer: config.baseUrl, keys }),
  })

  outgoing.writeHead(answer.status, Object.fromEntries(answer.headers))
  outgoing.end(await answer.text())
}
