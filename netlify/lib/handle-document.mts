import type { DocumentStore, StoredRecord } from './document-store.mjs'
import type { Identity } from './identity.mjs'

import { EndpointFault } from './endpoint-fault.mjs'

/**
 * One reader's document, kept behind a credential.
 *
 * Two rules carry the whole security of this endpoint and neither is a check
 * that could be deleted without a test failing.
 *
 * The **storage key is derived, never named**. It is built here from a subject
 * the signature established, and nothing in the request reaches it: no field in
 * the body, no value in the address. The route carries no identifier at all. So
 * addressing another reader's document is not expressible rather than merely
 * refused — which is a property that survives somebody later simplifying a
 * validation away, and which is also why the access log holds no user id.
 *
 * `suffix` does not weaken that and is worth saying out loud, because this is
 * where it could quietly be lost: it is a **constant the function module
 * chooses**, never a value read from the request. `v1/${sub}/teams` and
 * `v1/${sub}/preferences` are both derived from the subject and from nothing a
 * caller sent.
 *
 * **A suffix on both documents also makes a collision inexpressible, which is
 * the part of this that is not tidiness.** The teams suffix used to be empty,
 * so the key was `v1/${sub}` — and `v1/${sub}` is what
 * `v1/${'X/preferences'}` reads as when the teams document is asked for. A
 * subject of `X/preferences` and a subject of `X` composed to the same string,
 * so one reader could have landed on another's settings. It never could
 * happen, because `USABLE_SUBJECT` refuses `/` before a subject reaches here —
 * but it was refused by a regex rather than by the shape, and a regex is a
 * thing somebody widens. With both documents named, there is no subject and no
 * suffix that compose to another pair's key at all: reaching `v1/${sub}/teams`
 * from a different subject would need a document whose suffix is empty, and
 * neither is.
 *
 * And **nothing happens before the credential is checked**. An unauthenticated
 * request costs one signature verification against a warm key set and no
 * network call and no store access at all. The platform's free tier is a hard
 * cap that pauses every site on the account when it is reached, and it offers
 * no rate limiting to sit in front of this, so ordering is the control.
 */
export interface DocumentKind {
  /** What a reader who has stored nothing is answered with. */
  readonly empty: unknown
  readonly maxBytes: number
  readonly parse: (text: string) => ParsedDocument
  /** Appended to the derived key. A constant, never anything a request carried. */
  readonly suffix: string
}

export interface HandlerDependencies {
  readonly document: DocumentKind
  /**
   * Told of every `503`, with why (OBS-2). Never of a refusal the request itself
   * caused — a missing credential, a stale version, a body too large — because
   * those are this endpoint working. Reporting changes no answer.
   */
  readonly report?: (fault: EndpointFault) => void
  readonly store: DocumentStore
  readonly verify: (token: string) => Promise<Identity>
}

type ParsedDocument = { document: unknown; ok: true } | { ok: false }

const OK = 200
const BAD_REQUEST = 400
const UNAUTHENTICATED = 401
const NOT_ALLOWED = 405
const CONFLICT = 409
const TOO_LARGE = 413
const UNSUPPORTED_TYPE = 415
const PRECONDITION_REQUIRED = 428
const UNAVAILABLE = 503

interface Target {
  readonly document: DocumentKind
  readonly key: string
  readonly report: ((fault: EndpointFault) => void) | undefined
  readonly store: DocumentStore
}

/**
 * The header a write names the version it replaces in, and a response hands
 * the current version back in.
 *
 * Exported so both gateways spell it the same way as the handler, rather than
 * agreeing by coincidence across two layers and two runtimes.
 */
export const VERSION_HEADER = 'x-document-version'

/** What that header carries to mean "only if nothing is stored yet". */
export const ANY_VERSION = '*'

export async function handleDocument(
  request: Request,
  dependencies: HandlerDependencies,
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'PUT') {
    return failure(NOT_ALLOWED, 'method-not-allowed')
  }

  const identity = await identify(request, dependencies.verify)

  if (!identity.ok) {
    return identity.reason === 'unavailable'
      ? unavailable(new EndpointFault('identity-unavailable'), dependencies.report)
      : failure(UNAUTHENTICATED, 'unauthenticated')
  }

  const { document, report, store } = dependencies
  const target = { document, key: `v1/${identity.sub}${document.suffix}`, report, store }

  return request.method === 'GET' ? read(target) : write(request, target)
}

/**
 * Every response says not to keep it: these are somebody's colleagues.
 *
 * **The version goes back in `VERSION_HEADER`, never in `ETag`.** Netlify's CDN
 * rewrites `ETag` when it compresses a response — `"8c97…208"` reached the
 * browser as `"8c97…208-df"` — so the version a reader handed back named
 * nothing stored, and every save after their first was refused as a conflict.
 * It is the `If-Match` lesson the other way round: a header HTTP defines is a
 * header the path between here and the browser acts on. `ETag` is not sent at
 * all, so no client can read the corrupted copy instead.
 */
function answer(status: number, body: unknown, etag?: string): Response {
  const headers = new Headers({
    'cache-control': 'no-store',
    'content-type': 'application/json',
  })

  if (etag !== undefined) {
    headers.set(VERSION_HEADER, etag)
  }

  return Response.json(body, { headers, status })
}

/**
 * The body, or null when it is larger than this will read.
 *
 * Checked twice on purpose. `Content-Length` is a claim and refusing on it
 * early avoids reading at all; the second check is against what actually
 * arrived, because a chunked body can declare nothing and send anything.
 */
async function bodyOf(request: Request, maxBytes: number): Promise<null | string> {
  const declared = Number(request.headers.get('content-length') ?? '0')

  if (Number.isFinite(declared) && declared > maxBytes) {
    return null
  }

  const text = await request.text()

  return new TextEncoder().encode(text).length > maxBytes ? null : text
}

/**
 * What is stored now, so the caller can resolve rather than ask again.
 *
 * Last write wins over a whole roster silently drops a colleague off it, which
 * is the failure that screen least deserves — so a stale write is refused and
 * told what it was racing. A caller for whom last write *is* the answer, as the
 * reader's settings are, resolves this into one more write of its own; the rule
 * here stays the same either way, which is what lets one of them be a policy
 * and not a second endpoint.
 */
async function conflict(key: string, store: DocumentStore, kind: DocumentKind): Promise<Response> {
  const current = await store.read(key)
  const document = current === null ? kind.empty : storedOf(current, kind)

  return answer(CONFLICT, { error: 'conflict', ...(document as object) }, current?.etag)
}

function failure(status: number, error: string): Response {
  return answer(status, { error })
}

/**
 * Who is calling.
 *
 * A missing header and one the provider will not vouch for answer identically,
 * so probing this endpoint teaches nothing about which it was.
 */
async function identify(
  request: Request,
  verify: HandlerDependencies['verify'],
): Promise<Identity> {
  const header = request.headers.get('authorization') ?? ''
  const [scheme, token] = header.split(' ')

  if (scheme?.toLowerCase() !== 'bearer' || token === undefined || token === '') {
    return { ok: false, reason: 'unauthenticated' }
  }

  return verify(token)
}

/**
 * What the caller says it is replacing, or null when it says nothing.
 *
 * `*` is "only if nothing is stored", which maps onto the store's own null.
 * Anything else is the version being replaced.
 *
 * **Not `If-Match` and `If-None-Match`, which is what this used to be and what
 * the semantics are borrowed from.** Those never reached this function in
 * production: Netlify's CDN uses the `If-*` headers for its own conditional
 * requests and consumes them on the way through, so every write arrived with no
 * precondition and was refused `428` — correctly, and uselessly. The three
 * places that exercise this are the `functions` Vitest project, which calls the
 * handler directly, the acceptance suite, which route-stubs the endpoint, and
 * `bun run dev`, which is a Vite middleware. None of them has a CDN in it, so
 * nothing could see it. `docs/qa/release-checklist.md` carries the check that
 * can.
 *
 * A header of our own is not touched by anything in the path. It costs no
 * preflight, because the request is same-origin — and the endpoint still emits
 * no CORS headers, so a cross-site caller could not set it at all.
 */
function preconditionOf(request: Request): null | { expected: null | string } {
  const version = request.headers.get(VERSION_HEADER)

  if (version === null || version === '') {
    return null
  }

  return { expected: version === ANY_VERSION ? null : version }
}

/** What the stored text says, or an empty document for a reader with none. */
function read({ document: kind, key, report, store }: Target): Promise<Response> {
  return store
    .read(key)
    .then((record) =>
      record === null ? answer(OK, kind.empty) : answer(OK, storedOf(record, kind), record.etag),
    )
    .catch((error: unknown) =>
      unavailable(new EndpointFault('store-unavailable', { cause: error }), report),
    )
}

/**
 * A stored document, or an empty one when what is stored cannot be read.
 *
 * A truncated write is the store's problem to survive, not the reader's to see
 * as a failure — and an unreadable document is one they can replace.
 */
function storedOf(record: StoredRecord, kind: DocumentKind): unknown {
  const parsed = kind.parse(record.text)

  return parsed.ok ? parsed.document : kind.empty
}

/** A `503` carrying why, told to whoever is listening first. */
function unavailable(fault: EndpointFault, report: Target['report']): Response {
  report?.(fault)

  return failure(UNAVAILABLE, fault.reason)
}

async function write(
  request: Request,
  { document, key, report, store }: Target,
): Promise<Response> {
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) {
    return failure(UNSUPPORTED_TYPE, 'unsupported-media-type')
  }

  const precondition = preconditionOf(request)

  if (precondition === null) {
    // A write with no precondition is a caller that did not read first, and
    // accepting it is exactly the silent clobber the version check prevents.
    return failure(PRECONDITION_REQUIRED, 'precondition-required')
  }

  const body = await bodyOf(request, document.maxBytes)

  if (body === null) {
    return failure(TOO_LARGE, 'too-large')
  }

  const parsed = document.parse(body)

  if (!parsed.ok) {
    return failure(BAD_REQUEST, 'malformed')
  }

  try {
    const result = await store.write(key, JSON.stringify(parsed.document), precondition.expected)

    return result.ok
      ? answer(OK, parsed.document, result.etag)
      : await conflict(key, store, document)
  } catch (error) {
    return unavailable(new EndpointFault('store-unavailable', { cause: error }), report)
  }
}
