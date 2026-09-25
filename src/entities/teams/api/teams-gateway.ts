import { ANY_VERSION, VERSION_HEADER } from '@/shared/api'

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
 * A live identity assertion, or the one reason there can fail to be one.
 *
 * Whatever rejected in there, the answer out here is the same: nothing can prove
 * who this reader is, so the store cannot be asked. The session is not this
 * slice's to inspect — `Identified` is two methods precisely so it does not have
 * to be — so the rejection is translated at the boundary rather than escaping as
 * another slice's error class, which every caller then has to recognise or
 * misread.
 *
 * Which one it escapes as is the whole point. A grant made before this
 * application asked for an identity fails here every time and always will, since
 * renewing carries the original scopes forward. Escaping untranslated, it was
 * read as an unreachable store — and that reader was told to wait for an outage
 * that does not exist, when one more authorization is all it takes.
 */
async function assertion({ identified }: Attempt, renewFirst = false): Promise<string> {
  try {
    if (renewFirst) {
      await identified.refresh()
    }

    return await identified.identityToken()
  } catch {
    throw new TeamsError({ kind: 'identity-unavailable' })
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
  headers.set(VERSION_HEADER, etag ?? ANY_VERSION)

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
  const first = await submit(attempt, await assertion(attempt))

  if (first.status !== UNAUTHENTICATED) {
    return first
  }

  return submit(attempt, await assertion(attempt, true))
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
