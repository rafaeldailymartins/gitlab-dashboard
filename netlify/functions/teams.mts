import type { Config } from '@netlify/functions'

import { documentEndpoint } from '../lib/document-endpoint.mjs'
import { TEAMS_DOCUMENT } from '../lib/teams-document.mjs'

/**
 * The teams endpoint.
 *
 * Two rules hold the security of this feature and both live one module down, in
 * `handle-document.mts`: the storage key is derived from a verified subject and
 * never read from the request, and nothing touches the store before the
 * credential is checked. `document-endpoint.mts` is the wiring that lets those
 * be tested without a platform underneath them, and this file names the one
 * document it serves.
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
export default documentEndpoint({ document: TEAMS_DOCUMENT })

export const config: Config = { path: '/.netlify/functions/teams' }
