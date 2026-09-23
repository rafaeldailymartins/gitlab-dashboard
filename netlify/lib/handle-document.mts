import type { DocumentStore, StoredRecord } from './document-store.mjs'
import type { Identity } from './identity.mjs'

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
 * chooses**, never a value read from the request. `v1/${sub}` and
 * `v1/${sub}/preferences` are both derived from the subject and from nothing a
 * caller sent.
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

interface WriteTarget {
  readonly document: DocumentKind
  readonly key: string
  readonly store: DocumentStore
}

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
      ? failure(UNAVAILABLE, 'identity-unavailable')
      : failure(UNAUTHENTICATED, 'unauthenticated')
  }

  const { document, store } = dependencies
  const key = `v1/${identity.sub}${document.suffix}`

  return request.method === 'GET'
    ? read(key, store, document)
    : write(request, { document, key, store })
}

/** Every response says not to keep it: these are somebody's colleagues. */
function answer(status: number, body: unknown, etag?: string): Response {
  const headers = new Headers({
    'cache-control': 'no-store',
    'content-type': 'application/json',
  })

  if (etag !== undefined) {
    headers.set('etag', etag)
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
 * `If-None-Match: *` is "only if nothing is stored", which maps onto the store's
 * own null. Anything else is the version being replaced.
 */
function preconditionOf(request: Request): null | { expected: null | string } {
  const ifMatch = request.headers.get('if-match')

  if (ifMatch !== null && ifMatch !== '') {
    return { expected: ifMatch }
  }

  return request.headers.get('if-none-match') === '*' ? { expected: null } : null
}

/** What the stored text says, or an empty document for a reader with none. */
function read(key: string, store: DocumentStore, kind: DocumentKind): Promise<Response> {
  return store
    .read(key)
    .then((record) =>
      record === null ? answer(OK, kind.empty) : answer(OK, storedOf(record, kind), record.etag),
    )
    .catch(() => failure(UNAVAILABLE, 'store-unavailable'))
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

async function write(request: Request, { document, key, store }: WriteTarget): Promise<Response> {
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
  } catch {
    return failure(UNAVAILABLE, 'store-unavailable')
  }
}
