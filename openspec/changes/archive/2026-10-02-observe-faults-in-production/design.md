# Design

See `proposal.md` for why, and `specs/observability/spec.md` for what must hold.

## Context

- **The initial load is at 178.19 kB of 180 kB**, measured on `staging` at
  `a6fa2de` with `bun run build && bun run size`. The gate reads every file
  `dist/index.html` requests, so a module cannot leave the measurement without
  also leaving the page. About 1.8 kB is left for anything new.
- **The policy is `connect-src 'self' <gitlab>`**, written by
  `scripts/write-csp.ts` after the build. A tracker on another origin would
  widen it.
- **`bun audit` must report zero at any severity**, and it counts every
  transitive dependency, development ones included. `config/vite/api-dev.ts`
  already records the project turning down Netlify's Vite plugin and `@lhci/cli`
  for the size of their dependency trees.
- **Nothing reports today.**
  - `src/app/main.tsx` renders the router and nothing else.
  - `src/app/router.tsx` sets no error hook.
  - `createQueryClient` in `src/shared/api/query-client.ts` builds its caches
    with no `onError`.
  - The functions turn every fault into a response in
    `netlify/lib/handle-document.mts` (`failure(UNAVAILABLE, …)` at two sites)
    and `netlify/lib/document-endpoint.mts` (`unavailable()`,
    `storeUnavailable()`).
  - `no-console` is an error everywhere.
- **Failures are already classified.** `GraphQLRequestError.failure.kind` is
  `unauthorized`, `unavailable` or `rejected`, and the query client stops
  retrying the first and the last.
- **Source maps are public.** `vite.config.ts` sets `build.sourcemap: true`, so
  every chunk names a `.map` that the CDN serves.
- **Functions get configuration the way the bundle does.** `netlify/lib/gitlab.mts`
  reads `VITE_GITLAB_*` at run time under the bundle's own names. A function
  learns its deploy from `context.deploy.context`, not from `CONTEXT`, which
  exists only during the build (see `store-name.mts`).
- **`arch:trace`** reads requirements from `openspec/changes/` too, so OBS-1..8
  fail it until each is cited by a scenario or listed in `UNCITED_BY_DESIGN`.

## Goals / Non-Goals

**Goals:**

- Every fault in the specs reaches one place, grouped, with a readable stack,
  the release and the deploy, within a minute of happening.
- The privacy rule is a property the code proves. It does not depend on SDK
  defaults or on server-side scrubbing.
- The tool can be swapped by changing the DSN, not the code.

**Non-Goals:**

- **Performance tracing and Web Vitals.** A trace of this app is mostly its
  GitLab requests, and their URLs and timings say whose month was read. The
  app's performance is already held by `size-limit` and measured by hand in
  `docs/qa/`. Tracing would add about 10 kB to the lazy chunk and a second
  privacy surface, for figures nobody has asked for.
- **Session replay.** A recording of this screen is a recording of other people's
  names and hours. It is never turned on.
- **A log line per function request.** Netlify's free Observability already
  shows each function's status codes and latency for 24 hours. A log line would
  need an exception to `no-console` in the one module the identity verifier
  relies on it for, and it would record nothing about a fault that the tracker
  does not already have.
- **Breadcrumbs.** They are fetch URLs, console output and DOM clicks. Each
  carries exactly what OBS-3 forbids, and a stack plus a route is enough to
  find a fault in an app this size.

## Decisions

### 1. Sentry in its EU region, as the tool

These sizes were measured on 2026-10-01 by bundling each candidate's minimal
errors-only configuration with esbuild (minified, `gzip -9`):

| Candidate                                          | Browser, gzip                 | Same-origin tunnel           | Free plan                 | Fits                                                                              |
| -------------------------------------------------- | ----------------------------- | ---------------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| **Sentry** (`@sentry/browser` 11.2, custom client) | **20.9 kB**                   | `tunnel` option, first-class | 5k errors/month, 30 days  | ✅ errors in both runtimes, EU region (Frankfurt), the SDK is a de-facto protocol |
| Grafana Faro + Grafana Cloud                       | 40.1 kB (does not tree-shake) | configurable transport URL   | 50k sessions, 14 days     | ❌ twice the size, session-oriented, weaker grouping                              |
| OpenTelemetry web + OTLP                           | 18.6 kB, traces only          | exporter URL                 | backend needed            | ❌ no error grouping and no source maps                                           |
| PostHog                                            | 51.5–102 kB                   | reverse proxy                | 100k exceptions           | ❌ an analytics product first                                                     |
| Axiom / Better Stack Logs                          | 4.3–6.3 kB                    | needs a proxy                | generous / 3 days         | ❌ log shippers, no grouping                                                      |
| `@netlify/otel`, Log Drains                        | —                             | —                            | undocumented / Enterprise | ❌ not a product on this plan                                                     |
| Highlight.io                                       | —                             | —                            | —                         | ❌ shut down 2026-02-28                                                           |

Sentry is the one candidate that meets all four constraints in `proposal.md`.
The free plan's 5,000 errors a month is ample for a personal app, and the
tunnel endpoint below bounds what one misbehaving client can spend.

**What leaving would take.** Bugsink (hosted in the EU, or one Docker
container), GlitchTip (open source, with an EU option) and Better Stack Errors
all accept the Sentry SDK's envelopes. Moving to any of them means changing
`VITE_SENTRY_DSN` and the tunnel's allowed host, and nothing in `src/`.

### 2. A custom `BrowserClient`, not `init()` or `@sentry/react`

`@sentry/browser`'s `init()` registers every default integration (29.5 kB), and
`@sentry/react` adds an error boundary on top of that (30.7 kB). The monitoring
chunk instead builds a `BrowserClient` with only two integrations,
`linkedErrorsIntegration` and `dedupeIntegration`. It came to 21.4 kB of gzip
once built. Leaving the other integrations out is not only about size.
Breadcrumbs, the HTTP-client integration and the browser-session integration
are each a way for personal data to get in, so they are absent rather than
disabled.

`globalHandlersIntegration` was planned and is absent too: `monitoring.ts` is
listening to the window from the first load, before this chunk exists, and two
listeners would report every fault twice.

`httpContextIntegration` is also absent. It would supply the browser and the
system by sending the user-agent as a request header, which OBS-3 forbids. The
chunk's `beforeSend` adds the browser's name and major version and the system's
name itself, read from the user-agent in the page, and the screen's address,
before `scrub` runs.

Two options are set that the plan did not name. `enhanceFetchErrorMessages:
false` is needed because Sentry 11 otherwise rewrites the message of the app's
own fetch errors to append the host. The reporter also stops after twenty
reports a page: past that, a page has a loop rather than a list, and the rest
would cost invocations on a plan that pauses the site when they run out.

The router already draws route errors. Wrapping it in Sentry's error boundary
would only add a second component competing to draw the same thing (decision 4).

### 3. The entry holds a few hundred bytes; the SDK arrives when the page is idle

Both modules are in the app layer, and nothing below it reaches for either.
`createQueryClient` takes an `onFault` callback instead, which is how
`shared/` stays ignorant of the app. A sink module in `shared/` was the plan,
and it would have been a module-level buffer every test shares.

**`src/app/lib/fault-sink.ts`** is a factory for a sink with `report`,
`install` and `abandon`. Until a reporter is installed, faults go into a buffer
of at most ten entries. Ten is enough to survive a burst before the SDK arrives
without holding the page's memory hostage. A reporter that throws is
swallowed.

**`src/app/lib/monitoring.ts`** owns the page's one sink and does three things:

1. It adds `error` and `unhandledrejection` listeners that hand each fault to
   the sink.
2. When `VITE_SENTRY_DSN` was empty at build time, it does nothing else. The
   dynamic `import()` is behind that constant, so the bundler drops the chunk
   altogether (OBS-7).
3. Otherwise it waits for `requestIdleCallback`, falling back to the `load`
   event and never a timer. This follows `AGENTS.md`'s argument for the teams
   dialog: a timer would race the month's own requests. Then it imports
   `monitoring-sdk.ts`, installs the reporter, and the sink drains its buffer
   into it.

The SDK chunk loads once per page and never retries. If it cannot be fetched,
the buffer is dropped (OBS-6).

### 4. Where faults are caught, and which ones count

| Source                                | Hook                                                 | Reported when                                                                                                                                         |
| ------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Uncaught error, unhandled rejection   | `window` listeners in `monitoring.ts`                | always                                                                                                                                                |
| Route load and render                 | `createRoot(…, { onCaughtError, onUncaughtError })`  | always, except a not-found or a redirect. What is drawn does not change                                                                               |
| GitLab queries                        | `new QueryCache({ onError })` in `createQueryClient` | `unavailable` or `rejected`, or any error that is not a `GraphQLRequestError` (a zod parse failure is GitLab's schema drifting). Never `unauthorized` |
| The teams query                       | the same, read off `meta`                            | never. It carries `REPORTED_BY_ITS_ENDPOINT` beside `NOT_PERSISTED`, because the endpoint reports its own `503`s                                      |
| Document writes and the settings sync | none                                                 | never. The endpoint reports its own faults, and a `409` is a working conflict                                                                         |

`QueryCache.onError` runs once per failed query, after the retries, which is
what OBS-1 asks for.

`defaultOnCatch` was the plan for route errors, and it does not fire here.
TanStack Router wraps a match in a catch boundary only when the route or the
router has an error component. This app has neither, so a route error reaches
the router's global boundary, which draws it and, in production, calls nothing.
The `errorComponent` fallback was not taken either, because an error component
on every match would draw the error inside the layout rather than in place of
it. React 19's root options see every error any boundary catches, the global
one included, and a failed loader rethrows during render, so they see loader
errors too. `src/app/lib/route-faults.test.tsx` proves both against a real
router.

The classification is a pure function, `faultOf(error)`, in
`src/shared/api/fault.ts` beside the error class it reads. It returns either
nothing or a fault with a kind, and has unit tests over every kind. A refusal
comes back as a copy of the error without GitLab's messages, keeping the
original stack.

### 5. The privacy rule is an allowlist rebuild, proved by property tests

`beforeSend` does not delete fields it knows about. It builds a new event out of
these fields only:

- **`exception`**: type, frames and the mechanism's links between chained
  errors. Each frame keeps `filename` and `abs_path` cut at the first `?` or
  `#`, which also keeps a function's file path, plus `function`, `lineno`,
  `colno`, `in_app` and `debug_id`. Frame variables and context lines are
  dropped. The message is kept only for the app's own error classes
  (`GraphQLRequestError`, `AuthError`, `TeamsError`, `EndpointFault`) and for
  engine `TypeError`, `RangeError` and `ReferenceError`, cut at 200 characters.
  Every other message is replaced by its class name, because a `SyntaxError`
  from `JSON.parse` quotes its input.
- **`request.url`**: an `http`/`https` address without its query or fragment.
  Anything else is dropped.
- **`debug_meta`**: source-map images only, their file cut the same way.
- **`release`, `environment`, `platform`, `event_id`, `timestamp`, `level`**:
  kept.
- **`sdk`**: name and version, with `settings.infer_ip` forced to `never`, so
  the tracker does not record the address a report came from.
- **`contexts`**: `browser` and `os`, name and version only.
- **`tags`**: `origin`, `kind`, `document` and `reason`, as strings. Nothing
  else.

Every other field is dropped, whatever the SDK put there. That covers `user`,
`breadcrumbs`, `extra`, `request.headers`, `request.cookies`, `request.data` and
any field a later SDK version adds.

A denylist breaks when a new field arrives. An allowlist cannot be broken that
way, which matters because Sentry 11 replaced `sendDefaultPii` with
`dataCollection`, whose defaults are on. The client still sets
`dataCollection` to everything off and `sendClientReports: false`, as a second
layer, but the rebuild is what the tests prove.

`scrub(event)` is pure and lives in `src/shared/lib/scrub.ts`. A fast-check
property plants generated values (usernames, emails, team names, group paths,
`glpat-` tokens, query strings) in every field of a generated event, including
the exception message of an unknown error class, and asserts that none of them
survives. The same `scrub` runs in the functions. `netlify/` may not import
`src/`, so it runs there as a copy, and a contract test holds the two copies to
the same outputs over the same generated inputs. This is the same arrangement
the document-version header already uses.

### 6. A tunnel function on this origin

`netlify/functions/monitor.mts` is served at `/.netlify/functions/monitor`, the
path convention the other two functions use. Its body lives in
`netlify/lib/envelope-tunnel.mts`, which takes `fetch` as an injected parameter
so the `functions` project can test it:

1. With no `VITE_SENTRY_DSN`, answer `404` and forward nothing.
2. Accept `POST` only. A body over **100 kB**, declared or not, is refused with
   `413`. A stack from this app is a few kB.
3. Parse the body with `@sentry/core`'s own `parseEnvelope`, so items with a
   `length` and binary payloads are read as the SDK writes them. Its header's
   `dsn` must have the same host, port and project id as `VITE_SENTRY_DSN`. If
   it does not, or the body is not an envelope, the function answers `400` and
   forwards nothing.
4. Rebuild the envelope header from `dsn`, `event_id`, `sent_at` and the SDK's
   name and version. The trace context there carries a transaction name, which
   is an address with its query.
5. Keep only items of type `event`, each run through `scrub` again, so a client
   that skipped the browser's rebuild is still held to OBS-3. A body left with
   nothing in it is answered `204` and not forwarded.
6. `POST` to `https://<dsn host>[:port]/api/<project>/envelope/` with
   `content-type: application/x-sentry-envelope`, and with no header taken from
   the incoming request. Sentry then sees Netlify's address, not the reader's.
7. Answer with the upstream status, or `502` for a tracker that cannot be
   reached, and `cache-control: no-store`. An upstream failure is not reported
   again (OBS-6).

The tunnel requires no credential. A fault on `/login` or `/auth/callback`
happens before there is one, and those are the faults that lock somebody out.
That does not open anything new: a DSN is public by design, so anyone can
already post to the project directly. What the tunnel adds is invocations. It
declares no `rateLimit`, because `handle-document.mts` already records that
this plan offers none, and a limit the platform ignores reads as a control. The
bounds are in "Risks".

A `200!` rewrite in `netlify.toml` would forward with no code at all. It was
rejected because it can neither validate the project nor rebuild the events,
and it would pass the client's headers through.

### 7. Functions use `@sentry/core`'s server client, not `@sentry/node`

`@sentry/node` 11 is built on OpenTelemetry instrumentation. That means
`import-in-the-middle`, `require-in-the-middle` and about a dozen
`@opentelemetry/*` packages, and its automatic instrumentation needs a
`--import` flag that a Netlify function cannot pass. Errors-only capture would
work without it, but the whole tree would still be installed, which is surface
for `bun audit` and a likely candidate for esbuild's `external_node_modules`.

`@sentry/core` has no third-party dependencies. Its `ServerRuntimeClient`,
exported from the `@sentry/core/server` subpath rather than the package root,
is how Sentry's own edge SDKs report.

`netlify/lib/fault-reporter.mts` builds one such client, with a fetch transport,
`scrub` and nothing collected. A missing DSN gives `SILENT_REPORTER`, which
`config/vite/api-dev.ts` also passes, so `bun run dev` never reports.

A `503` is reported as an `EndpointFault` from `netlify/lib/endpoint-fault.mts`.
It is made where the endpoint gave up, so each site has a stack of its own and
groups as an issue of its own. Its message is the reason and nothing else, and
the store's own error, which can quote the key it failed on (the key holds the
reader's subject), travels as its `cause`, where only the class and stack
survive `scrub`.

The reporter is a port, like `store` and `keys`. `netlify/lib/endpoint-reporting.mts`
builds it once per instance, for the environment the first invocation names,
and wraps the endpoint: `handleDocument` and `documentEndpoint` call a
`report` at each `503` site, and an exception thrown out of either is reported
and thrown again, so the platform's answer stays what it is today (OBS-2).

Sending must not keep a reader waiting on a fault path. When the invocation
offers `context.waitUntil`, the flush runs there. Otherwise it is awaited,
capped at 2 s.

### 8. Release and environment are named once and read by both runtimes

The **environment** comes from a mapping in
`netlify/lib/deploy-environment.mts`, beside `store-name.mts`, which reads the
same context:

| Deploy context   | Environment   |
| ---------------- | ------------- |
| `production`     | `production`  |
| `branch-deploy`  | `staging`     |
| `deploy-preview` | `preview`     |
| `dev`            | `development` |
| anything else    | `unknown`     |

`vite.config.ts` imports that mapping and applies it to `CONTEXT` at build time,
as `config/vite/api-dev.ts` already imports from `netlify/lib/`. So there is one
table and no copy of it.

The **release** is the commit. The bundle receives it through `define` from
`COMMIT_REF`. A function cannot: Netlify's documentation says a function at run
time is given `URL`, `SITE_NAME` and `SITE_ID` and none of the build's
variables. So the `netlify.toml` build command writes the commit into
`netlify/lib/release.json`, which `netlify/lib/release.mts` imports and esbuild
inlines when the functions are bundled after the command. The file in the
repository carries an empty commit, so a local run and the tests report under no
release rather than under a stale one. That is simpler than the
`included_files` route the plan named, and needs no file read at run time.

### 9. Source maps are hidden, uploaded when there is a token, and always deleted

`build.sourcemap` becomes `'hidden'`, so the maps are still written but no chunk
points to them. `bun run build` then runs two scripts after the CSP writer:

- `scripts/upload-source-maps.ts` uploads `dist/assets` with `@sentry/cli`'s
  JavaScript API, under the release, when `SENTRY_AUTH_TOKEN` is set. It
  refuses a token with no `COMMIT_REF`, since a map under no release matches
  no report, and it says so when it skips.
- `scripts/drop-source-maps.ts` deletes every `dist/**/*.map` and fails if any
  chunk still names one. That makes OBS-8 a build failure rather than a review
  comment, and it holds for forks and local builds, where nothing is uploaded.

**`@sentry/vite-plugin` was measured and taken out.** It injects a debug-ID
snippet into every chunk, and on this bundle that brought the initial load to
181.43 kB, which is 3.26 kB more. Without it the load is 178.17 kB, so
everything else in this change cost nothing measurable. The plan's fallback
was taken instead: maps are matched by release and file name. Chunks name no
map, and `sentry-cli` pairs `index-abc.js` with the `index-abc.js.map` beside it
on its own. The binary's own message says it guesses "based on the file name".
What this loses is a match that survives a file being renamed after the build,
which nothing here does. The ceiling was not raised.

### 10. The acceptance suite builds with a DSN that goes nowhere

`playwright.config.ts` builds the acceptance bundle as a homologation deploy of
a commit called `acceptance`, with
`VITE_SENTRY_DSN=https://public@o0.ingest.example.invalid/1`, so the reporting
chunk is compiled in and its release and environment can be asserted. Only the
scenarios in `features/acceptance/report-a-fault.feature` route the tunnel,
through `tests/e2e/support/monitor-api.ts`, and read what arrives. Every other
scenario's reports reach a preview server that answers them with nothing,
which is a tracker being down and is silent by OBS-6. A fixture in every test
was the plan, and it would have been one more thing every scenario depends on,
for no assertion. `vite preview` runs no function, so the stubbed route is all
the tunnel there is in that suite, exactly as for the document endpoints. The
Vitest projects define no DSN, so they load nothing.

## Risks / Trade-offs

- **[The SDK's dependency tree fails `bun audit`]** → It did not. The audit
  reported zero with `@sentry/browser`, `@sentry/core` and `@sentry/cli` 3,
  whose own dependencies are four small packages and a platform binary that
  arrives as an optional dependency, so `--ignore-scripts` installs it.
- **[The tunnel is invoked by somebody other than this app]** → This plan has
  no rate limiting, and its free tier pauses every site on the account when the
  credits run out, so invocations are what an abuser would spend. The tunnel
  is no worse than the two document endpoints, which an unauthenticated caller
  can already invoke. Every refusal (wrong method, oversized, not an envelope,
  another project) happens before a request leaves the function. The browser
  sends at most twenty reports a page, so a loop in this app cannot spend
  credits. Sentry's spike protection and a per-key rate limit cap what reaches
  the quota. A 5k-a-month free plan running out means faults go unseen until
  the month resets, and never that the app breaks (OBS-6).
- **[A fault message carries something personal]** → Messages are kept only for
  the app's own classes and three engine error types, and are cut at 200
  characters. Sentry's server-side scrubbing and "Prevent storing of IP
  addresses" are turned on as a third layer, recorded in the setup steps.
- **[The debug-ID snippet breaks the 180 kB budget]** → It did, by 1.43 kB.
  Decision 9's fallback was taken, and the ceiling was not raised.
- **[`defaultOnCatch` does not see loader errors]** → It sees nothing in this
  app. Decision 4 reports from React's root options instead.
- **[The CI size gate measures a build with no DSN]** → `bun run size` in CI
  measures 178.17 kB. With a DSN, as production builds, the entry carries the
  sink's import and three literals, and measured 178.27 kB. The 0.1 kB
  difference is inside the budget, and the reporting chunk is outside both
  measurements.
- **[`sentry-cli` pairs a map with the wrong file]** → It can only pair files
  that share a name, and every chunk's name carries its content hash. Step 6.3
  checks that a stack from homologation reads as the source.
- **[The EU region is chosen when the organisation is created, and cannot be
  changed later]** → The setup steps say so before anything else. A US
  organisation created by mistake is deleted, not migrated.
- **[Sentry is a proprietary service]** → Decision 1's exit costs one variable.

## Migration Plan

1. Create a Sentry organisation in the **EU (Frankfurt)** region and a
   `javascript-react` project. In the project's settings:
   - turn on "Prevent storing of IP addresses";
   - keep server-side data scrubbing on;
   - turn spike protection on;
   - set a rate limit on the DSN key;
   - keep the default alert, an email on every new issue.
2. In Netlify:
   - set `VITE_SENTRY_DSN` for every deploy context, so that homologation and
     previews report under their own environment;
   - set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` for builds only.

   Order does not matter. A bundle built without the DSN reports nothing, and a
   DSN without the new bundle is read by nothing.

3. Deploy to `staging`. The release checklist's new step is to break a request
   on purpose in homologation and see the issue arrive, tagged `staging`, with a
   readable stack and none of OBS-3's fields.
4. Promote.

**Rollback.** Unsetting `VITE_SENTRY_DSN` and redeploying stops all reporting
without touching code. Reverting the change removes the tunnel function.
Neither direction moves any reader's data.
