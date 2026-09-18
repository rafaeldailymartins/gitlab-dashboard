import type { Config } from '@netlify/functions'

import type { Identity, VerifierOptions } from '../lib/identity.mjs'

import { blobTeamStore } from '../lib/blob-store.mjs'
import { gitLabConfig } from '../lib/gitlab.mjs'
import { handleTeams } from '../lib/handle-teams.mjs'
import { providerKeys, verifyIdentity } from '../lib/identity.mjs'

/**
 * The teams endpoint.
 *
 * Two rules hold the security of this feature and both live one module down, in
 * `handle-teams.mts`: the storage key is derived from a verified subject and
 * never read from the request, and nothing touches the store before the
 * credential is checked. This file is the wiring that lets those be tested
 * without a platform underneath them.
 *
 * **It authenticates from the `Authorization` header and from nothing else.**
 * No cookie, no session, no `Origin` allow-list — and it emits no CORS headers
 * at all. That is what makes it CSRF-exempt rather than CSRF-lucky: a
 * cross-site form cannot set that header, and a cross-site `fetch` that does
 * triggers a preflight this will not answer. Adding either a cookie credential
 * or a permissive CORS header would quietly undo it.
 *
 * It is on this origin so that the app's `connect-src 'self'` already reaches
 * it. That is the whole reason the store is Netlify's rather than a database
 * somewhere else — every alternative would widen the policy.
 */
export default async function teams(request: Request): Promise<Response> {
  const config = gitLabConfig(process.env)

  if (config === null) {
    return unavailable()
  }

  const keys = await resolveKeys(config.baseUrl)

  if (keys === null) {
    return unavailable()
  }

  const options: VerifierOptions = {
    audience: config.clientId,
    issuer: config.baseUrl,
    keys,
  }

  return handleTeams(request, {
    store: blobTeamStore(),
    verify: (token): Promise<Identity> => verifyIdentity(token, options),
  })
}

export const config: Config = { path: '/.netlify/functions/teams' }

/**
 * The provider's keys, fetched once per cold start and reused after that.
 *
 * Held as the promise rather than its result so that several requests arriving
 * together on a cold instance share one discovery rather than racing four.
 */
let pending: null | Promise<null | VerifierOptions['keys']> = null

function resolveKeys(baseUrl: string): Promise<null | VerifierOptions['keys']> {
  pending ??= providerKeys(baseUrl).then((keys) => {
    if (keys === null) {
      // A failed discovery must not be cached, or one bad minute would outlast
      // itself for the whole life of the instance.
      pending = null
    }

    return keys
  })

  return pending
}

/** Says only that identity could not be established, never why. */
function unavailable(): Response {
  return Response.json(
    { error: 'identity-unavailable' },
    { headers: { 'cache-control': 'no-store' }, status: 503 },
  )
}
