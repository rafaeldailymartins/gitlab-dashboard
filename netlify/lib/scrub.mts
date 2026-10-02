/*
 * A copy of `src/shared/lib/scrub.ts`, for the functions.
 *
 * `netlify/` is another runtime and must not import from `src/` at run time,
 * so the rule is stated twice — and `scrub-contract.test.mts` feeds both copies
 * the same generated reports and fails the moment their answers differ. Change
 * one, change the other: the contract test is what notices if you do not.
 */
import type { Event, Exception, Mechanism, StackFrame } from '@sentry/core'

/**
 * A fault report rebuilt out of the fields that locate a fault, and nothing else.
 *
 * **An allowlist, not a denylist.** The report is built afresh from the fields
 * named below, so a field this module has never heard of — one a later SDK adds,
 * or one an integration fills in — cannot reach the tracker, because nothing
 * copies it. Deleting known fields instead would be correct exactly until the
 * next release, and Sentry 11 already turned on by default most of what this
 * app must never send: identities, headers, cookies, bodies, GraphQL variables.
 *
 * What the reader's screen holds is other people's names and hours, so the rule
 * is proved by a property test that plants generated personal values in every
 * field and finds none of them afterwards (OBS-3).
 *
 * This copy is what the functions and the tunnel apply; the browser applies
 * `src/shared/lib/scrub.ts`, and `scrub-contract.test.mts` holds them to one answer.
 */
export function scrub(event: Event): Event {
  return compact({
    contexts: contextsOf(event.contexts),
    debug_meta: debugMetaOf(event.debug_meta),
    environment: event.environment,
    event_id: event.event_id,
    exception: exceptionsOf(event.exception?.values),
    level: event.level,
    platform: event.platform,
    release: event.release,
    request: requestOf(event.request?.url),
    sdk: sdkOf(event.sdk),
    tags: tagsOf(event.tags),
    timestamp: event.timestamp,
  })
}

/**
 * Error classes whose messages this app or the JavaScript engine wrote.
 *
 * The app's own say only which kind of failure it was. The engine's name a
 * property or a value's type. Everything else — a plain `Error`, a library's,
 * a `SyntaxError` from `JSON.parse`, which quotes the text it could not read —
 * may carry anything, so its message is replaced by its class.
 */
const KNOWN_MESSAGES = new Set([
  'AuthError',
  'EndpointFault',
  'GraphQLRequestError',
  'RangeError',
  'ReferenceError',
  'TeamsError',
  'TypeError',
])

const MESSAGE_LIMIT = 200

const TAGS = new Set(['document', 'kind', 'origin', 'reason'])

/** The fields of `T` that may be missing, made optional rather than allowed to be `undefined`. */
type Compacted<T> = {
  [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined>
} & {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K]
}

type Images = NonNullable<NonNullable<Event['debug_meta']>['images']>

function compact<T extends object>(value: T): Compacted<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as Compacted<T>
}

function contextsOf(contexts: Event['contexts']): Event['contexts'] {
  if (contexts === undefined) {
    return undefined
  }

  const kept = compact({
    browser: nameAndVersion(contexts['browser']),
    os: nameAndVersion(contexts.os),
  })

  return Object.keys(kept).length === 0 ? undefined : kept
}

function debugMetaOf(meta: Event['debug_meta']): Event['debug_meta'] {
  const images = meta?.images?.flatMap((image): Images => {
    const codeFile = sourceOf(image.code_file)

    return image.type === 'sourcemap' && codeFile !== undefined
      ? [{ code_file: codeFile, debug_id: image.debug_id, type: 'sourcemap' }]
      : []
  })

  return images === undefined ? undefined : { images }
}

function exceptionOf(exception: Exception): Exception {
  const type = exception.type

  return compact({
    mechanism: mechanismOf(exception.mechanism),
    stacktrace:
      exception.stacktrace?.frames === undefined
        ? undefined
        : { frames: exception.stacktrace.frames.map((frame) => frameOf(frame)) },
    type,
    value: messageOf(type, exception.value),
  })
}

function exceptionsOf(values: Exception[] | undefined): Event['exception'] {
  return values === undefined ? undefined : { values: values.map((value) => exceptionOf(value)) }
}

function frameOf(frame: StackFrame): StackFrame {
  return compact({
    abs_path: sourceOf(frame.abs_path),
    colno: frame.colno,
    debug_id: frame.debug_id,
    filename: sourceOf(frame.filename),
    function: frame.function,
    in_app: frame.in_app,
    lineno: frame.lineno,
  })
}

function mechanismOf(mechanism: Mechanism | undefined): Mechanism | undefined {
  return mechanism === undefined
    ? undefined
    : compact({
        exception_id: mechanism.exception_id,
        handled: mechanism.handled,
        is_exception_group: mechanism.is_exception_group,
        parent_id: mechanism.parent_id,
        source: mechanism.source,
        synthetic: mechanism.synthetic,
        type: mechanism.type,
      })
}

function messageOf(type: string | undefined, value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }

  return type !== undefined && KNOWN_MESSAGES.has(type)
    ? value.slice(0, MESSAGE_LIMIT)
    : (type ?? 'Error')
}

function nameAndVersion(context: unknown): undefined | { name?: string; version?: string } {
  if (typeof context !== 'object' || context === null) {
    return undefined
  }

  const { name, version } = context as Record<string, unknown>

  return compact({
    name: typeof name === 'string' ? name : undefined,
    version: typeof version === 'string' ? version : undefined,
  })
}

function requestOf(url: string | undefined): Event['request'] {
  const kept = withoutQuery(url)

  return kept === undefined ? undefined : { url: kept }
}

/**
 * The SDK's name and version, and an instruction not to infer an address.
 *
 * Without `infer_ip: 'never'` the tracker records the address the report came
 * from. Through the tunnel that is Netlify's rather than the reader's, but the
 * rule should not depend on which way a report travelled.
 */
function sdkOf(sdk: Event['sdk']): Event['sdk'] {
  return sdk === undefined
    ? undefined
    : compact({ name: sdk.name, settings: { infer_ip: 'never' as const }, version: sdk.version })
}

/**
 * Where a frame's code lives, without a query or a fragment.
 *
 * A browser frame names a web address and a function's frame names a file
 * path, which `URL` either refuses or reads as a scheme (`node:`, `C:`). Both
 * are cut at the first `?` or `#`, which is the only place either could carry
 * something about a request.
 */
function sourceOf(source: string | undefined): string | undefined {
  return source?.split(/[#?]/u, 1)[0]
}

function tagsOf(tags: Event['tags']): Event['tags'] {
  if (tags === undefined) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(tags).filter(([key, value]) => TAGS.has(key) && typeof value === 'string'),
  )
}

/** A web address without its query or fragment, or nothing for one that is not a web address. */
function withoutQuery(url: string | undefined): string | undefined {
  if (url === undefined || !URL.canParse(url)) {
    return undefined
  }

  const parsed = new URL(url)

  return parsed.protocol === 'https:' || parsed.protocol === 'http:'
    ? `${parsed.origin}${parsed.pathname}`
    : undefined
}
