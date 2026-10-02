import type { DsnComponents, Envelope, Event } from '@sentry/core'

import { dsnFromString, parseEnvelope, serializeEnvelope } from '@sentry/core'

import { scrub } from './scrub.mjs'

export interface TunnelOptions {
  /** The project reports are for. Without one there is nowhere to forward to. */
  readonly dsn: string | undefined
  /** Injected in tests; the real one is the platform's. */
  readonly fetch: typeof fetch
}

/** A stack from this app is a few kB; this leaves room for a long chain of causes. */
const MAX_BYTES = 100_000

const BAD_REQUEST = 400
const NOT_FOUND = 404
const NOT_ALLOWED = 405
const TOO_LARGE = 413
const BAD_GATEWAY = 502
const NO_CONTENT = 204

type Item = Envelope[1][number]

/**
 * The browser's fault reports, forwarded from this origin to the tracker (OBS-4).
 *
 * On this origin so the policy's `connect-src` stays this site and GitLab. The
 * SDK's `tunnel` option posts each report here as an envelope, and this rebuilds
 * it before it goes anywhere:
 *
 * - **Only the configured project.** The envelope names its project, and one
 *   naming any other is refused before anything is fetched, so this is not a
 *   relay for whoever finds it.
 * - **Only error events**, each run through `scrub` again. A client that skipped
 *   its own scrub — or one that is not this app — is held to OBS-3 all the same.
 * - **No header of the incoming request.** The forward is a new request carrying
 *   a content type and nothing else, so the tracker sees Netlify's address, never
 *   the reader's, and never a cookie or a credential.
 *
 * It asks for no credential, unlike the document endpoints beside it. A fault
 * on the sign-in page or the OAuth callback happens before there is one, and
 * those are the faults that lock somebody out. That opens nothing new: a DSN is
 * public by design, so anybody can already post to the project directly. What
 * is cheap here is refusing — every refusal above happens before a request
 * leaves this function.
 */
export function envelopeTunnel(options: TunnelOptions): (request: Request) => Promise<Response> {
  const project = projectOf(options.dsn)

  return async (request) => {
    if (project === null) {
      return answer(NOT_FOUND)
    }

    if (request.method !== 'POST') {
      return answer(NOT_ALLOWED)
    }

    const body = await bodyOf(request)

    if (body === null) {
      return answer(TOO_LARGE)
    }

    const envelope = envelopeFor(body, project)

    if (envelope === null) {
      return answer(BAD_REQUEST)
    }

    return envelope[1].length === 0 ? answer(NO_CONTENT) : forward(envelope, project, options.fetch)
  }
}

function answer(status: number): Response {
  return new Response(null, { headers: { 'cache-control': 'no-store' }, status })
}

/** The body, or null when it is larger than a report could be — declared or not. */
async function bodyOf(request: Request): Promise<null | string> {
  const declared = Number(request.headers.get('content-length') ?? '0')

  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    return null
  }

  const text = await request.text()

  return new TextEncoder().encode(text).length > MAX_BYTES ? null : text
}

/**
 * The envelope rebuilt for forwarding, or null for one this will not forward.
 *
 * The header keeps what addresses the envelope and drops the rest: the trace
 * context there carries a transaction name, which is an address with its query.
 */
function envelopeFor(body: string, project: DsnComponents): Envelope | null {
  const parsed = parsedEnvelope(body)

  if (parsed === null || !namesProject(parsed[0], project)) {
    return null
  }

  return [headerOf(parsed[0]), parsed[1].flatMap((item) => eventItem(item))] as Envelope
}

/** An error event, scrubbed — or nothing, for any other kind of item. */
function eventItem([header, payload]: Item): Item[] {
  return header.type === 'event' ? [[header, scrub(payload as Event)] as Item] : []
}

async function forward(
  envelope: Envelope,
  project: DsnComponents,
  upstream: typeof fetch,
): Promise<Response> {
  const port = project.port === undefined || project.port === '' ? '' : `:${project.port}`
  const url = `https://${project.host}${port}/api/${project.projectId}/envelope/`

  // Every item left is an event, which is JSON, so the envelope is text however
  // the serializer chose to hand it back.
  const serialized = serializeEnvelope(envelope)
  const body = typeof serialized === 'string' ? serialized : new TextDecoder().decode(serialized)

  try {
    const response = await upstream(url, {
      body,
      headers: { 'content-type': 'application/x-sentry-envelope' },
      method: 'POST',
    })

    return answer(response.status)
  } catch {
    // A tracker that cannot be reached changes nothing the reader sees, and is
    // not reported in turn (OBS-6).
    return answer(BAD_GATEWAY)
  }
}

/** The envelope's header with what addresses it and nothing else. */
function headerOf(header: Envelope[0]): Envelope[0] {
  const kept: Record<string, unknown> = { dsn: header.dsn, sent_at: header.sent_at }

  if (header.event_id !== undefined) {
    kept['event_id'] = header.event_id
  }

  if (header.sdk !== undefined) {
    kept['sdk'] = { name: header.sdk.name, version: header.sdk.version }
  }

  return kept
}

function namesProject(header: Envelope[0], project: DsnComponents): boolean {
  const named = typeof header.dsn === 'string' ? dsnFromString(header.dsn) : undefined

  return named !== undefined && sameProject(named, project)
}

function parsedEnvelope(body: string): Envelope | null {
  try {
    const envelope = parseEnvelope(body)

    return typeof envelope[0] === 'object' && Array.isArray(envelope[1]) ? envelope : null
  } catch {
    return null
  }
}

function projectOf(dsn: string | undefined): DsnComponents | null {
  const parsed = dsn === undefined || dsn.trim() === '' ? undefined : dsnFromString(dsn.trim())

  return parsed?.protocol === 'https' ? parsed : null
}

function sameProject(left: DsnComponents, right: DsnComponents): boolean {
  return left.host === right.host && left.port === right.port && left.projectId === right.projectId
}
