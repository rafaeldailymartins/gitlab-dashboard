import type { Identified, TeamsDocument, TeamsGateway } from '../model/ports'

import { TeamsError } from '../model/ports'
import { decodeTeams, encodeTeams } from '../model/team'

/**
 * The teams endpoint, over HTTP.
 *
 * Same origin, which is the whole reason the store is the host's rather than a
 * database somewhere else: `connect-src 'self'` already reaches it, so the
 * Content-Security-Policy needs no second origin and there is no preflight.
 */
const ENDPOINT = '/.netlify/functions/teams'

const UNAUTHENTICATED = 401
const CONFLICT = 409
const UNAVAILABLE = 503

interface Attempt {
  readonly body?: string
  readonly etag?: null | string
  readonly identified: Identified
  readonly method: 'GET' | 'PUT'
  readonly signal?: AbortSignal | undefined
}

export function httpTeamsGateway(identified: Identified): TeamsGateway {
  return {
    async read(signal) {
      return documentOf(await send({ identified, method: 'GET', signal }))
    },

    async write(document, signal) {
      return documentOf(
        await send({
          body: encodeTeams(document.teams),
          etag: document.etag,
          identified,
          method: 'PUT',
          signal,
        }),
      )
    },
  }
}

/**
 * What the store answered, or why it did not.
 *
 * A conflict carries the current document, so the caller can resolve rather
 * than only re-ask — and so a reader is told their team changed elsewhere
 * instead of quietly losing the change they were making.
 */
async function documentOf(response: Response): Promise<TeamsDocument> {
  if (response.status === CONFLICT) {
    throw new TeamsError({ current: await parse(response), kind: 'conflict' })
  }

  if (response.status === UNAUTHENTICATED) {
    throw new TeamsError({ kind: 'identity-unavailable' })
  }

  if (response.status >= UNAVAILABLE) {
    throw new TeamsError({ kind: 'unavailable' })
  }

  if (!response.ok) {
    throw new TeamsError({ kind: 'rejected' })
  }

  return parse(response)
}

function headersFor({ body, etag }: Attempt, token: string): Headers {
  const headers = new Headers({ authorization: `Bearer ${token}` })

  if (body === undefined) {
    return headers
  }

  headers.set('content-type', 'application/json')
  // A write names the version it was made against, or asserts there is none.
  // The endpoint refuses one that names neither, because that is a caller which
  // never read — and accepting it is the silent clobber this prevents.
  const version = etag ?? null

  if (version === null) {
    headers.set('if-none-match', '*')
  } else {
    headers.set('if-match', version)
  }

  return headers
}

async function parse(response: Response): Promise<TeamsDocument> {
  return { etag: response.headers.get('etag'), teams: decodeTeams(await response.text()) }
}

/**
 * One attempt, and exactly one retry behind a forced renewal.
 *
 * The same shape `graphQLClient` uses, for the same reason: an assertion lives
 * two minutes, so one arriving a moment late is ordinary rather than
 * exceptional. Two refusals in a row is a real one.
 */
async function send(attempt: Attempt): Promise<Response> {
  const first = await submit(attempt, await attempt.identified.identityToken())

  if (first.status !== UNAUTHENTICATED) {
    return first
  }

  await attempt.identified.refresh()

  return submit(attempt, await attempt.identified.identityToken())
}

async function submit(attempt: Attempt, token: string): Promise<Response> {
  try {
    return await fetch(ENDPOINT, {
      ...(attempt.body === undefined ? {} : { body: attempt.body }),
      headers: headersFor(attempt, token),
      method: attempt.method,
      ...(attempt.signal === undefined ? {} : { signal: attempt.signal }),
    })
  } catch (error) {
    // An abort is the caller changing its mind, not the store failing.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    throw new TeamsError({ kind: 'unavailable' })
  }
}
