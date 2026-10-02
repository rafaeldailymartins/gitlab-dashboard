# Tasks

Steps marked **(owner)** change something outside the working tree, such as an
account, a platform setting or a deploy. They are taken only with the owner's
go-ahead at the time.

## 1. Dependencies and baseline, before anything depends on them

- [x] 1.1 Add `@sentry/browser` and `@sentry/core` as dependencies, and the
      tool that uploads source maps as a dev dependency, reading the lockfile
      diff for what came with them. Gate: `bun audit` at zero. It is — and the
      upload tool became `@sentry/cli` 3 rather than `@sentry/vite-plugin`, for
      the size reason in 4.8, not the audit
- [x] 1.2 Record the initial load before anything else changes. Gate:
      `bun run build && bun run size` reports 178.19 kB on `staging` at
      `a6fa2de`
- [x] 1.3 Add OBS-2 and OBS-8 to `UNCITED_BY_DESIGN` in
      `scripts/check-traceability.ts`, each naming what proves it: the
      `functions` tests for the endpoint, `drop-source-maps.ts` failing the
      build for the maps. OBS-4 is cited by an acceptance scenario (the policy);
      the script holds one id to one place, so its forwarding half is proved by
      `envelope-tunnel.test.mts` without an entry. Gate: `bun run arch:trace`

## 2. The pure rules, test-first

- [x] 2.1 `src/shared/lib/scrub.ts` and its tests, written first: an event
      rebuilt from decision 5's allowlist alone. The examples drop `user`,
      `breadcrumbs`, `extra` and every `request` field but the address; cut the
      query and fragment from the address, from each frame and from each debug
      image; keep a function's file path; keep the message of the app's own
      classes and of `TypeError`, `RangeError` and `ReferenceError`, cut at 200
      characters; replace any other class's message with its name; and set
      `sdk.settings.infer_ip` to `never`. Gate: `bun run test:coverage`, 100% of
      lines on the module
- [x] 2.2 `src/shared/lib/scrub.properties.test.ts` plants generated usernames,
      emails, team names, group paths, `glpat-` tokens and query strings in
      every field of a generated event, the message of an unknown class
      included, and finds none of them afterwards (OBS-3). Gate: `bun run test`.
      Adding `user` to the allowlist made it fail with a printed counterexample;
      reverted
- [x] 2.3 `src/shared/api/fault.ts` holds `faultOf(error)`, beside the error
      class it reads, and its tests were written first: nothing for
      `unauthorized`, for a cancelled query and for an aborted request; a fault
      of that kind for `unavailable` and `rejected`, as a copy without GitLab's
      messages that keeps the original stack; `unexpected` for anything else,
      wrapping a thrown value that is not an error. Gate:
      `bun run test:coverage`, 100% on the module
- [x] 2.4 `src/app/lib/fault-sink.ts` and its tests, written first. It is in
      `app/` rather than `shared/`, because nothing below the app needs it once
      `createQueryClient` takes an `onFault` callback (4.3) — and a module-level
      buffer in `shared/` would have been global state every test shares. It
      holds faults until a reporter is installed and drains them in order, keeps
      the newest ten, swallows a reporter that throws (OBS-6), and drops what it
      holds when told reporting will never arrive. Gate: `bun run test`
- [x] 2.5 `netlify/lib/deploy-environment.mts` and its test, written first:
      every row of decision 8's table, and `unknown` for a missing or
      unrecognised context. Gate: `bun run test` (`functions` project)
- [x] 2.6 `netlify/lib/scrub.mts` is the same rule for the functions, and
      `netlify/lib/scrub-contract.test.mts` feeds both copies the same
      generated events and requires equal answers. Gate: `bun run test`. Four
      single-copy edits — the message limit, the class list, keeping the query,
      a fifth tag — each made it fail; reverted

## 3. The functions

- [x] 3.1 `netlify/lib/envelope-tunnel.mts` and its tests, written first, with
      `fetch` injected. Envelopes are read and written with `@sentry/core`'s
      own `parseEnvelope` and `serializeEnvelope`. The tests cover `405` for
      anything but `POST`, `413` for a body over 100 kB whether declared or
      not, `400` for a body that is not an envelope and for a DSN naming
      another host or project with `fetch` never called (OBS-4, "A report for
      another project"), `204` for an envelope of nothing but non-`event`
      items, scrubbed events, an envelope header kept to what addresses it, no
      incoming header passed on, a self-hosted tracker on its own port, `404`
      with nothing configured, and the upstream status — or `502` for a
      tracker that cannot be reached — returned with `no-store`. Gate:
      `bun run test:coverage`
- [x] 3.2 `netlify/functions/monitor.mts` is served at
      `/.netlify/functions/monitor` and is one call to the tunnel. It declares
      no `rateLimit`: `handle-document.mts` already records that this plan
      offers none, and a limit the platform ignores reads as a control. Gate:
      `bun run typecheck`, `bun run deadcode`, `bun run arch:graph`
- [x] 3.3 `netlify/lib/fault-reporter.mts` builds `ServerRuntimeClient` from
      `@sentry/core/server` — the subpath, not the package root — with a fetch
      transport, `scrub` and nothing collected; with no DSN it is
      `SILENT_REPORTER`. `netlify/lib/endpoint-fault.mts` is the error a `503`
      is reported as, made where the endpoint gave up so each site groups on
      its own, with the store's error as its `cause`. Gate: `bun run test`. The
      tests cover nothing sent without a DSN, one tagged envelope with `fetch`
      injected, a store error's message (which can quote the reader's key)
      never sent, and a tracker that cannot be reached never throwing
- [x] 3.4 The reporter is threaded through `documentEndpoint` and
      `handleDocument` as an injected port, like `store` and `keys`, by way of
      `netlify/lib/endpoint-reporting.mts`. In
      `handle-document.reporting.test.mts` each `503` site reports its reason
      ("The store cannot be reached"), `401`, `405`, `409`, `413`, `415`, `428`
      and `400` report nothing ("A stale write", "An unsigned request"), and the
      answer is identical with and without a reporter. In
      `document-endpoint.reporting.test.mts` the endpoint's own `503`s report
      their reason and document, a thrown exception is reported and thrown
      again, and the reporter is built once per instance for its deploy. Gate:
      `bun run test`, with every existing test in `handle-document.test.mts`
      and `document-endpoint.test.mts` passing unchanged
- [x] 3.5 After a fault, the flush is handed to `context.waitUntil` when the
      invocation offers it and awaited for at most 2 s when it does not; after a
      request that went well nothing is flushed at all. Gate: `bun run test`,
      one case for each path and one for a tracker whose flush rejects
- [x] 3.6 `config/vite/api-dev.ts` passes `SILENT_REPORTER`, so `bun run dev`
      reports nothing whatever `.env` holds. Verified by construction: the
      silent reporter has no transport to send with

## 4. The browser

- [x] 4.1 `src/app/lib/monitoring-sdk.ts` builds a `BrowserClient` with the
      tunnel, `dedupeIntegration` and `linkedErrorsIntegration` only — not
      `globalHandlersIntegration`, since `monitoring.ts` was already listening
      to the window before this chunk existed — `dataCollection` with every
      category off, `enhanceFetchErrorMessages: false` (Sentry 11 otherwise
      rewrites the app's own fetch errors), `sendClientReports: false`, and a
      `beforeSend` that adds the address and the browser's name and major
      version, then scrubs. It stops after twenty reports a page. The transport
      is injectable, because Sentry's fetch transport takes a pristine `fetch`
      from a sandboxed frame and no stub sees it. Gate:
      `src/app/lib/monitoring-sdk.test.ts`
- [x] 4.2 `src/app/lib/monitoring.ts` listens to `error` and
      `unhandledrejection` into the sink and, when the build has a DSN, imports
      the SDK on `requestIdleCallback`, falling back to `load`. `LOAD` is
      decided at module scope from a literal, so a build without a DSN emits no
      chunk at all. Called first thing in `main.tsx`. Gate:
      `src/app/lib/monitoring.test.ts`, covering a fault held until the SDK
      arrives, nothing fetched with nothing configured, the `load` fallback,
      and a failed import dropping the buffer silently
- [x] 4.3 `createQueryClient` takes `onFault` and builds its `QueryCache` with
      an `onError` that reports `faultOf(error)` unless the query carries
      `REPORTED_BY_ITS_ENDPOINT`, which the teams query now does beside
      `NOT_PERSISTED`. `app/lib/query.ts` hands faults to the sink. Gate:
      `src/shared/api/query-client.test.ts`: one report after three attempts
      for `unavailable`, none for `unauthorized`, none for a query its endpoint
      reports
- [x] 4.4 Route errors are reported from `createRoot`'s `onCaughtError` and
      `onUncaughtError`, not from `defaultOnCatch`: the router calls that only
      beside an error component, and none here has one, so its global boundary
      draws the error and tells nobody. Decision 4's `errorComponent` fallback
      was not taken either, because it would draw the error inside the layout
      rather than in place of it. A not-found and a redirect are not reported.
      Gate: `src/app/lib/route-faults.test.tsx`, against a real router: a loader
      error and a render error are each reported once and draw "Something went
      wrong!" as they always did; a not-found is not reported
- [x] 4.5 `vite.config.ts` defines the DSN, the release (`COMMIT_REF`) and the
      environment (`CONTEXT` through `environmentFor`) as literals on every
      build, and sets `build.sourcemap: 'hidden'`. `src/app/env.d.ts` types the
      three. Gate: `bun run build` with and without a DSN
- [x] 4.6 `scripts/upload-source-maps.ts` uploads `dist/assets` with
      `sentry-cli` under the release when `SENTRY_AUTH_TOKEN` is set, refuses a
      token with no `COMMIT_REF`, and says so when it skips;
      `scripts/drop-source-maps.ts` then deletes every map and fails if any
      chunk names one (OBS-8). Both run inside `bun run build`. Gate:
      `bun run build` leaves no `.map` and no `sourceMappingURL` in `dist/`
- [x] 4.7 Netlify sets `COMMIT_REF` during the build only — a function at run
      time gets `URL`, `SITE_NAME` and `SITE_ID`, per its documentation — so
      the `netlify.toml` build command writes it into
      `netlify/lib/release.json`, which `netlify/lib/release.mts` imports and
      esbuild inlines. The file in the repository carries an empty commit.
      Gate: `bun run typecheck` and the `functions` project here; the
      homologation step in 6.3 shows the same release on a browser issue and a
      function issue
- [x] 4.8 Initial load. `@sentry/vite-plugin` measured at 181.43 kB: its
      debug-ID snippet in every chunk cost 3.26 kB, everything else in this
      change cost nothing measurable. Decision 9's fallback was taken — the
      plugin is gone, maps are matched by release and file name, which
      `sentry-cli` pairs on its own for chunks that name no map. Gate:
      `bun run size` at 178.17 kB with no DSN and 178.27 kB with one; the
      reporting chunk, 21.4 kB, is in neither measurement

## 5. Acceptance, and the words around it

- [x] 5.1 `playwright.config.ts` builds the acceptance bundle with a DSN that
      reaches nothing, as a homologation deploy of a commit called
      `acceptance`. Only the scenarios that read reports route the tunnel; every
      other scenario's reports reach a preview server that answers them with
      nothing, which is a tracker being down and OBS-6 says is silent — a
      fixture in every test would have been one more thing every scenario
      depends on, for no assertion. Gate: `bun run test:e2e`, 118 passed
- [x] 5.2 `features/acceptance/report-a-fault.feature`, with its steps in
      `tests/e2e/steps/observability.ts` and the recording stub in
      `tests/e2e/support/monitor-api.ts`: GitLab unreachable (OBS-1, OBS-3), a
      fault on a team's report narrowed to a group (OBS-3), the policy (OBS-4),
      the first load (OBS-5), the tunnel refusing everything (OBS-6) and a
      report naming its release and deploy (OBS-7). Gate: `bun run test:e2e`,
      `bun run arch:trace`. With the browser's scrub removed, the team scenario
      failed on "Squad Fiscal" in the report; reverted
- [x] 5.3 The "nothing configured" half of OBS-7 is tested in the unit project
      (`monitoring.test.ts`: no load, no install) and was confirmed on the build
      itself: without a DSN, no `monitoring-sdk` chunk is emitted. Gate:
      `bun run test`
- [x] 5.4 `README.md` and `README.pt-BR.md`, in the same edit: the setup step
      for a Sentry organisation in the EU region with the project settings from
      `design.md`'s migration plan and the four variables, `.env.example`
      gaining the DSN, and under "Security and privacy" what a report contains
      and what it never does. Verify: the two files have the same sections in
      the same order
- [x] 5.5 `AGENTS.md` gains a decision covering Sentry and the custom client,
      the sink and the idle import, the allowlist scrub, the tunnel taking no
      credential, `@sentry/core/server` over `@sentry/node`, the plugin that
      was measured out, the release file and the maps never being served; and
      the architecture tree gains `monitor.mts`, the reporting modules and the
      two build scripts. Verify: `bun run verify`
- [x] 5.6 `docs/qa/release-checklist.md` gains the homologation step — break a
      request on purpose and see the issue arrive with a readable stack, the
      `staging` environment and none of OBS-3's fields — and
      `docs/qa/quality-metrics.md` gains the scrub property test, the contract
      test and the source-map check. Verify: `bun run verify`
- [x] 5.7 Everything together. Gate: `bun run verify && bun run test`,
      `bun run test:coverage`, `bun run test:e2e` and
      `bun run build && bun run size`, all green

## 6. Rollout

- [x] 6.1 **(owner)** Create the Sentry organisation in the **EU (Frankfurt)**
      region and a `javascript-react` project; in its settings turn on "Prevent
      storing of IP addresses", keep server-side data scrubbing, turn on spike
      protection, set a rate limit on the DSN key, and keep the new-issue email
      alert. Verify: the organisation's settings show the EU data storage
      location
- [x] 6.2 **(owner)** In Netlify, set `VITE_SENTRY_DSN` for every deploy
      context, and `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` for
      builds only. Verify: `netlify env:list` shows each in its intended scope
- [ ] 6.3 **(owner)** Merge into `staging` and run the new release-checklist
      step on homologation. Verify: a browser issue and a function issue both
      arrive tagged `staging`, with a source-mapped stack and the same release;
      neither carries anything OBS-3 forbids; `/assets/*.map` is not served
- [ ] 6.4 **(owner)** Promote to `main`. Verify: the production deploy's first
      fault arrives tagged `production`
