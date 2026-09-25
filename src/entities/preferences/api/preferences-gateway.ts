import type { Identified, PreferencesDocument, PreferencesGateway } from '../model/ports'
import type { StoredPreferences } from '../model/preferences'

import { decodeStoredPreferences } from '../model/preferences'
import { reconcile } from '../model/reconcile'

/**
 * The settings endpoint, over HTTP.
 *
 * Same origin, which is the whole reason the store is the host's rather than a
 * database somewhere else: `connect-src 'self'` already reaches it, so the
 * Content-Security-Policy needs no second origin and there is no preflight.
 */
const ENDPOINT = '/.netlify/functions/preferences'

const CONFLICT = 409
const UNAUTHENTICATED = 401

/** What the document version is, on the wire. */
const VERSION = 1

interface Attempt {
  readonly body?: string
  readonly etag?: null | string
  readonly method: 'GET' | 'PUT'
  readonly signal?: AbortSignal | undefined
}

interface Racing {
  readonly identified: Identified
  /** What this device is trying to store. */
  readonly ours: PreferencesDocument
  /** What the store answered the refused write with. */
  readonly theirs: PreferencesDocument
}

export function httpPreferencesGateway(identified: Identified): PreferencesGateway {
  return {
    async read(signal) {
      return documentOf(await send(identified, { method: 'GET', signal }))
    },

    async write(document, signal) {
      const first = await send(identified, {
        body: bodyOf(document.settings),
        etag: document.etag,
        method: 'PUT',
        signal,
      })

      return first.status === CONFLICT
        ? resolve({ identified, ours: document, theirs: await contested(first) }, signal)
        : documentOf(first)
    },
  }
}

/** The document as the endpoint accepts it: the settings, flat, with a version. */
function bodyOf(settings: null | StoredPreferences): string {
  if (settings === null) {
    // Unreachable through the port — `write` is only ever called with settings
    // to store — and cheaper to answer than to type around.
    return JSON.stringify({ version: VERSION })
  }

  return JSON.stringify({
    ...settings.preferences,
    updatedAt: settings.updatedAt,
    version: VERSION,
  })
}

/**
 * The document a refused write was racing.
 *
 * A `409` is the one status that is neither a success nor a failure: it carries
 * what is stored, which is exactly what resolving the race needs. So it is read
 * rather than thrown, which is why it does not go through `documentOf`.
 */
async function contested(response: Response): Promise<PreferencesDocument> {
  const etag = response.headers.get('etag')

  try {
    const body: unknown = await response.json()

    return typeof body === 'object' && body !== null
      ? { etag, settings: settingsOf(body) }
      : { etag, settings: null }
  } catch {
    return { etag, settings: null }
  }
}

/**
 * What the store answered, as a document.
 *
 * **A refusal throws.** It used to resolve as `settings: null` — one rule for
 * every shape of nothing — and that made a 503 indistinguishable from a reader
 * the store has never heard of. The caller then recorded the refusal as a
 * success: it cleared its held version, reported the settings as synced, and
 * never sent the change again. The reader's new time zone existed on one device
 * while the screen asserted it had reached the others.
 *
 * Only a `200` is an answer. A body that is not a readable document *within* one
 * — `null` for a reader with nothing stored, or a truncated write — is still
 * `settings: null`, which `reconcile` reads as "send yours".
 */
async function documentOf(response: Response): Promise<PreferencesDocument> {
  if (!response.ok) {
    throw new Error(`the settings store answered ${String(response.status)}`)
  }

  return contested(response)
}

/**
 * What a write names, which the endpoint refuses to do without.
 *
 * A caller holding no version is asserting there is nothing stored; one holding
 * a version is replacing exactly it. There is no third case, which is what stops
 * a client that never read from clobbering a device that did.
 */
function precondition(etag: null | string | undefined): [string, string] {
  return etag === null || etag === undefined ? ['if-none-match', '*'] : ['if-match', etag]
}

/**
 * Last write wins, out of a store that refuses stale writes.
 *
 * The endpoint's discipline is not weakened to get this: it still refuses a
 * write that names the wrong version, and still refuses one that names none.
 * What changes is who resolves the refusal. A roster's reader resolves it — they
 * are told the list changed elsewhere, because silently losing a colleague is
 * the worst thing that surface can do. Nobody is watching a time zone save, so
 * this resolves it: if what is stored was written later, it is the answer; if
 * ours was, we write once more against the version we were just handed.
 *
 * At most two writes. A second conflict is read rather than retried, which is
 * the same answer last-write-wins would give — a third writer landing between
 * them is by definition later than both — and it is what makes this terminate
 * rather than loop against a device that is writing steadily.
 */
async function resolve(
  { identified, ours, theirs }: Racing,
  signal?: AbortSignal,
): Promise<PreferencesDocument> {
  if (ours.settings === null || reconcile(ours.settings, theirs.settings) !== 'push') {
    return theirs
  }

  const second = await send(identified, {
    body: bodyOf(ours.settings),
    etag: theirs.etag,
    method: 'PUT',
    signal,
  })

  if (second.status !== CONFLICT) {
    return documentOf(second)
  }

  return documentOf(await send(identified, { method: 'GET', signal }))
}

/**
 * One request, with one retry on a credential that expired in flight.
 *
 * An identity assertion lives two minutes, so the one read out of the session
 * may have died between being read and being spent. The retry mints a fresh one
 * and goes again — once, because a second 401 is a session that cannot prove
 * anybody, which no amount of asking repairs.
 */
async function send(
  identified: Identified,
  attempt: Attempt,
  renewFirst = false,
): Promise<Response> {
  if (renewFirst) {
    await identified.refresh()
  }

  const token = await identified.identityToken()
  const headers = new Headers({ authorization: `Bearer ${token}` })

  if (attempt.method === 'PUT') {
    headers.set('content-type', 'application/json')
    headers.set(...precondition(attempt.etag))
  }

  const response = await fetch(ENDPOINT, {
    ...(attempt.body === undefined ? {} : { body: attempt.body }),
    ...(attempt.signal === undefined ? {} : { signal: attempt.signal }),
    headers,
    method: attempt.method,
  })

  return response.status === UNAUTHENTICATED && !renewFirst
    ? send(identified, attempt, true)
    : response
}

/** A stored document, or null when what came back was not one. */
function settingsOf(body: object): null | StoredPreferences {
  if (!('timeZone' in body) || !('updatedAt' in body)) {
    return null
  }

  return decodeStoredPreferences(JSON.stringify(body))
}
