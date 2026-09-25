import type { Config } from '@netlify/functions'

import { documentEndpoint } from '../lib/document-endpoint.mjs'
import { PREFERENCES_DOCUMENT } from '../lib/preferences-document.mjs'

/**
 * The reader's own settings — the daily target and the time zone.
 *
 * A second endpoint rather than a second field on the teams document, and the
 * reason is the reconciliation rather than tidiness. A team is refused when it
 * is stale and the reader is told; settings are last write wins, in the
 * background. One document would make a colour of a number lose a version race
 * against an edit to a roster, and would make every rename of a team rewrite
 * the reader's time zone.
 *
 * Everything about the credential is `handle-document.mts`'s, unchanged: the key
 * is derived from a verified subject and from nothing the request carried, and
 * nothing touches the store before the signature is checked. The document this
 * names is a constant in a module, never a value a caller sent, and its suffix
 * is what keeps one reader's two documents apart.
 */
export default documentEndpoint({ document: PREFERENCES_DOCUMENT })

export const config: Config = { path: '/.netlify/functions/preferences' }
