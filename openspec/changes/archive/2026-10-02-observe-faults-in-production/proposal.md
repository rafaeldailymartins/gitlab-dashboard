# Faults in production are reported, and nothing about the reader goes with them

## Why

Nothing in this app tells its author that it has failed. The browser has no
error handler beyond what React and the router draw on screen, the two
functions turn every fault into a `503` and keep no record of it, and
`no-console` makes even a log line a lint error. A document endpoint whose key
discovery is failing, a store that will not answer, a render error on one
reader's month: each is found out only when somebody opens the screen and
mentions it. Netlify's free plan shows a function's status codes for 24 hours
and says nothing about the browser at all. People other than the author read
their hours here now, and the release flow added in `promote-through-staging`
moves changes into production on a schedule the author does not watch live.

Choosing a tool here is mostly choosing what it may not do. The initial load
is at **178.19 kB of a 180 kB budget**, the Content-Security-Policy reaches
this origin and GitLab and nothing else, the data on screen is other people's
names and hours, and `bun audit` must report zero at any severity. The research
recorded in `design.md` measured the candidates against those four constraints.
Sentry, in its EU region, is the one that meets all of them: it is an error
tracker rather than a log shipper, its browser SDK can be fetched after first
paint, it is reachable through a tunnel on this origin, it can be configured to
collect nothing personal, and its free plan covers a personal app.

## What Changes

- **The browser reports faults.** Uncaught errors, unhandled rejections, errors
  the router catches while rendering a route, and GitLab requests that failed
  for a reason other than an expired credential, once the query client has
  stopped retrying them. A credential GitLab no longer accepts is the session
  ending, which the app already handles, so it is not a fault.
- **The document endpoints report faults.** An exception thrown inside a
  function, and every `503` the handler answers with (`identity-unavailable`,
  `store-unavailable`), carrying which of them it was. A request the endpoint
  refused because of the request itself (`401`, `409`, `413`, `415`, `428`,
  `400`) is the endpoint working, and is not reported.
- **A report carries nothing about the reader or their colleagues.** No subject,
  username, name, email, token, team name, group path, query string, request
  body, GraphQL document or variables, message text GitLab sent, cookie, header
  or IP address. It carries the error's type and stack, the route's path,
  the release, the deploy and the browser. This is enforced by a scrubbing rule
  in code, tested against generated personal values, and not by trusting the
  SDK's defaults: on the current major version they collect most of the above.
- **Reports go through this origin.** A third function,
  `netlify/functions/monitor.mts`, receives the browser's reports and forwards
  them to the configured Sentry project. It accepts only error events for that
  one project, up to a size bound, and forwards no client address, cookie or
  credential. The Content-Security-Policy does not change.
- **Monitoring costs the first paint nothing.** The browser SDK is a separate
  chunk fetched when the page is idle. Until it arrives, a few hundred bytes
  in the entry hold onto any fault that happens and hand it over once the SDK
  is there. The 180 kB budget is unchanged.
- **Each report names its release and its deploy.** The commit and whether it
  came from production, homologation or a deploy preview. A build without
  a DSN configured (local runs, the test suites, forks) reports nothing and
  loads nothing.
- **Source maps stop being published.** They are uploaded to Sentry at build
  time and removed from `dist/`. That is how a stack trace from a minified
  bundle becomes readable, and with this change nobody needs them served
  publicly.
- **Monitoring never breaks the app.** An SDK that fails to load, a tunnel that
  refuses or a project over its quota is silent to the reader.
- **One new setting**, `VITE_SENTRY_DSN`, read by the bundle and by the
  functions under the same name, as the GitLab variables already are, and
  `SENTRY_AUTH_TOKEN` for the build only. Both READMEs gain the setup steps and
  the list of what a report contains. `AGENTS.md` gains the decision.

## Capabilities

### New Capabilities

- `observability`: which faults are reported, from the browser and from the
  document endpoints; what a report may and may not contain; the route a
  report takes to the error tracker; and what monitoring may cost the reader in
  bytes, requests and failures.

### Modified Capabilities

None. No screen changes what it shows. A route error is still drawn the way it
is drawn today, and the endpoints answer every request with the status and body
they answer with now.

## Impact

- **Dependencies:** `@sentry/browser` and `@sentry/core` (runtime),
  `@sentry/cli` (build). `@sentry/node` is deliberately not used, and
  `@sentry/vite-plugin` was measured and taken out; see `design.md`. Each one
  keeps `bun audit` at zero.
- **Browser:** `src/app/main.tsx` (`createRoot`'s error options),
  `src/shared/api/query-client.ts`, the teams query's `meta`, the pure rules in
  `src/shared/lib/scrub.ts` and `src/shared/api/fault.ts`, and the wiring and
  the lazy SDK in `src/app/lib/`.
- **Functions:** a new `netlify/functions/monitor.mts` over
  `netlify/lib/envelope-tunnel.mts`. A reporter port is threaded through
  `document-endpoint.mts` and `handle-document.mts`, the same way the store and
  the key source already are, by way of `endpoint-reporting.mts`.
- **Build:** `vite.config.ts` (`sourcemap: 'hidden'` and the reporting
  literals), two scripts inside `bun run build` that upload and then delete the
  maps, and `netlify.toml` writing the commit for the functions.
- **Gates:** `size-limit` keeps 180 kB; `bun run arch:trace` gains the new
  requirements; a new acceptance feature intercepts the tunnel and reads what a
  report contains.
- **Operations:** a Sentry organisation created **in the EU region** (it
  cannot be moved later), with server-side IP storage disabled, plus the two
  variables in Netlify. `docs/qa/release-checklist.md` gains a step that proves a
  report arrives from the deployed site.
