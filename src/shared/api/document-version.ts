/**
 * How a write names the version it is replacing.
 *
 * Borrowed semantics, deliberately not borrowed spelling. `If-Match` and
 * `If-None-Match: *` say exactly this and are what these two started as — but
 * they never reached the endpoint in production. Netlify's CDN uses the `If-*`
 * headers for its own conditional requests and consumes them on the way
 * through, so every write arrived carrying no precondition at all and was
 * refused `428`: correctly, and uselessly, on a deployed site while every gate
 * stayed green.
 *
 * Nothing in the path has a reason to touch a header of ours. It costs no
 * preflight either, because these requests are same-origin — and the endpoint
 * still emits no CORS headers, so a cross-site caller could not set it.
 *
 * **The answer carries the version back the same way, and for the same kind of
 * reason.** It used to come back as `ETag`, which the CDN rewrites when it
 * compresses a response — `"8c97…208"` arrived as `"8c97…208-df"`. The version
 * a reader then handed back named nothing stored, so every save after the first
 * was refused "changed somewhere else", and settings quietly stopped syncing.
 * Every first write goes out as `*`, which is why a deploy could look healthy:
 * only the second save goes down this path.
 *
 * Here in `shared/` because both gateways need it and FSD forbids one entity
 * slice reaching into another. The endpoint declares the same two values for
 * itself, since `netlify/` is a different runtime that must not import from
 * `src/` at run time; `handle-document.test.mts` holds the two spellings
 * against each other so they cannot drift apart in silence — which is the
 * failure this whole change is about.
 */
export const VERSION_HEADER = 'x-document-version'

/** What that header carries to mean "only if nothing is stored yet". */
export const ANY_VERSION = '*'
