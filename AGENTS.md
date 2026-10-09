# AGENTS.md

Personal dashboard of hours logged in GitLab issues and merge requests. Read
`README.md` for setup and the GitLab OAuth application it needs.

**Everything in this repository is written in English** — code, comments, commit
messages, documentation, Gherkin features. User-facing strings never appear as
literals; they live in `messages/{en,pt-BR}.json` and reach the UI through
Paraglide. The one exception is `README.pt-BR.md`, the Portuguese translation of
`README.md`: a change to either README is made to both, screenshots included
(`docs/screenshots/*.{en,pt-BR}.png`).

## Commands

| Command                           | What it does                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run dev`                     | Dev server on http://localhost:3000, with both document endpoints served by `config/vite/api-dev.ts`                                      |
| `bun run verify`                  | Every fast gate: format, lint, ARIA, contrast, translations, types, architecture, traceability, dead code, type coverage, vulnerabilities |
| `bun run test`                    | Unit, component, Gherkin domain and serverless-function tests (`domain` + `functions` + `ui` Vitest projects)                             |
| `bun run test:coverage`           | Same, with coverage thresholds enforced                                                                                                   |
| `bun run test:e2e`                | Builds, serves `dist/`, runs Playwright over `features/acceptance/*.feature` — chromium locally, three browsers in CI                     |
| `bun run test:mutation`           | Stryker mutation testing on the model layer                                                                                               |
| `bun run build` && `bun run size` | Production build, its Content-Security-Policy, and the 196 kB gzip budget                                                                 |
| `bun run arch:trace`              | Every scenario cites a requirement, and every requirement is cited                                                                        |
| `bun run lint:a11y`               | Biome, ARIA rules and unique element ids only                                                                                             |
| `bun run a11y:contrast`           | Every colour pair that has to stay legible, measured against both schemes                                                                 |
| `bun run i18n:check`              | Every message exists in every language, and no message exists in only one                                                                 |

Run `bun run verify && bun run test` before calling any change finished.

### Runtime

Bun is the package manager, script runner and runtime. Three exceptions, all
deliberate and each marked where it is invoked:

- **Stryker runs on Node** (`node ./node_modules/@stryker-mutator/core/bin/stryker.js`).
  Its plugin loader cannot resolve its own TestRunner plugins under Bun.
- **Playwright runs on Node.** `bddgen` runs on Bun; the test run does not.
- **The acceptance suite's preview server runs on Node**
  (`node ./node_modules/vite/bin/vite.js preview`, in `playwright.config.ts`).
  Under `bun --bun` it dies with `ERR_STREAM_WRITE_AFTER_END` when a response is
  written after its connection closed — which a browser closing a page
  mid-response does routinely. The process exits, and every scenario after that
  point fails for want of a server rather than for anything it asserts. The
  `vite build` before it still runs on Bun.

Everything else uses `bun --bun`, except `arch:graph` and `types:coverage`,
which name their binaries bare and so run on whatever their shebang says. Both
run green under `bun --bun`; they stay bare because `knip` recognises a
dependency's binary only as the first word of a script, and prefixed it reports
`dependency-cruiser` and `type-coverage` as unused — the alternative is an
ignore entry, which would stop it noticing if either really were.
`bunfig.toml` is deliberately absent: a global
`[run] bun = true` symlinks `node` to Bun, which silently breaks the three tools
above.

## Architecture

Feature-Sliced Design on the outside, Clean Architecture inside each slice.

```
src/
  app/          router, providers, global styles, and routes/ (TanStack Router
                file-based routing lives inside the app layer, because route
                files are wiring). `lib/runtime.ts` builds the session manager,
                the timelog and viewer gateways and the data client once, from one
                configuration read — it hands out the client rather than a third
                gateway, so a screen most readers never open keeps its adapter
                out of the bundle everybody downloads;
                `lib/query.ts` builds the cache and its persister;
                `lib/monitoring.ts` holds faults from the first load and fetches
                `lib/monitoring-sdk.ts`, which sends them, when the page is idle. The
                signed-in header lives in `routes/_authenticated.tsx`, so the
                guard that proves there is a session is the same thing that
                decides the chrome exists.
  pages/        screen composition. A block with one consumer lives here rather
                than in widgets/, which is what steiger requires.
    dashboard/    the KPI row, the week strip, the day feed and their derivations,
                  and the day control
    day-detail/   one day, addressable
    insights/     the month heatmap, the project split, the top-items table, and
                  the month control
    settings/     the preference fields, and the card that opens the teams dialog
    team-hours/   a team’s month as a person × day matrix, its toolbar, its
                  group filter and its notices
    login/, auth-callback/, not-configured/
  widgets/      composed blocks with more than one consumer
    hours-report/ the query, the report and the status notice — used by the
                  dashboard and by the day screen
    team-manager/ the dialog the teams a reader keeps are edited in: the rail of
                  teams, the editor, the person search, and the group list that
                  builds a whole team in one action. A dialog and not a screen,
                  opened from the report and from a settings card — a reader
                  notices a team is wrong while reading its month, and that list
                  has no address worth sending anybody
  features/     single user interactions (theme/). The group picker used to live
                here for its two consumers; the teams surface reaches a group
                through a list of rows to press rather than a combobox now, so
                the report is the only consumer and the control went back into
                pages/team-hours/ui/group-filter.tsx
  entities/     domain slices (plural names, kept consistent by steiger)
    timelogs/
      model/    PURE business rules and ports. No React, no I/O, no strings.
      api/      adapters: the GitLab GraphQL gateway, zod schemas, query options
      ui/       the gateway provider
      lib/      the words a screen writes where a project has no name
      index.ts  public API — import from here, never from internals
    sessions/     PKCE, credentials, the OAuth adapter and the token stores
    viewers/      who is signed in, on its own query so a screen that wants a
                  name does not load a season of hours to get one
    preferences/  daily target, time zone, theme choice, and the sync that
                  carries the first two to the endpoint below
    team-timelogs/ one team’s month, read through a `User` parent: the widened
                  window, the grid, the shortfall measured against GitLab’s own
                  totals, the column probe that puts a withheld hour on its own
                  day, and the suggestions a team is seeded from
    teams/        the lists of people the reader keeps — the document, its
                  gateway to the endpoint below, and every edit a team can take
  shared/       ui (shadcn plus ours), api (the GraphQL client, the query client,
                the cache persister, the never-persisted mark, the
                reported-by-its-endpoint mark, which failures are faults, and the
                document-version header), lib (including the scrub every fault
                report is rebuilt by), i18n, config
netlify/        the two document endpoints and the fault-reporting tunnel:
                `functions/{teams,preferences,monitor}.mts` name a document or a
                project and nothing else, and `lib/` holds everything worth
                testing — the endpoint body they share, the handler under it and
                its credential rules, each document's own shape, the identity
                verifier and the configuration it reads, the store each deploy is
                given, the blob store and the in-memory one the tests and
                `bun run dev` use, the tunnel, and the reporter the endpoints
                tell their faults to
config/         eslint/ (the layer, purity and limit rules) and
                vite/api-dev.ts, which serves that same handler under
                `bun run dev` in a few dozen lines rather than a platform emulator
scripts/        build and gate tooling: the CSP writer, the traceability check,
                the contrast measurement, the translation-parity check, the
                lockfile snapshot GitHub's dependency review reads, the source-map
                upload and removal every build ends with, and the message
                compiler, which every `pre*` script calls and which rebuilds only
                when the catalogues change
```

`model/` and `api/` are FSD's own segment names; they carry the Clean
Architecture meaning: `model` is the domain layer, `api` is the infrastructure
adapter. Both linters recognise them, which custom names like `domain/` and
`infra/` would not.

### Rules that are enforced, not suggested

| Rule                                                                                                                                | Enforced by                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| A layer imports only from layers below it                                                                                           | `boundaries/dependencies` (`config/eslint/layers.js`)        |
| Slice public API, no cross-slice imports, no layer skipping                                                                         | `steiger` (`bun run arch:layers`)                            |
| No import cycles, no orphan modules, no devDependency in `src/` or `netlify/`                                                       | `dependency-cruiser` (`bun run arch:graph`, over both trees) |
| `model/` stays pure: no React, no `@tanstack/*`, no `api/`, no i18n, no `fetch`/`window`/`localStorage`                             | `DOMAIN_PURITY_RULES` (`config/eslint/layers.js`)            |
| The browser bundle never imports `node:*`                                                                                           | `BROWSER_ONLY_RULES`                                         |
| Cyclomatic complexity ≤ 8, cognitive complexity ≤ 10, ≤ 40 lines per function (60 for components), ≤ 200 lines per file, ≤ 3 params | `config/eslint/limits.js`                                    |
| No unused export, file or dependency                                                                                                | `knip` (`bun run deadcode`)                                  |
| ARIA attributes are supported by the role they sit on                                                                               | `biome` (`bun run lint:a11y`)                                |
| Every colour pair stays above its contrast floor, in both schemes                                                                   | `scripts/check-contrast.ts` (`bun run a11y:contrast`)        |
| Every message exists in every language                                                                                              | `scripts/check-messages.ts` (`bun run i18n:check`)           |
| ≥ 99% of expressions carry a real type                                                                                              | `type-coverage`                                              |
| Zero advisories in production dependencies, at any severity; none in tooling that `scripts/audit/accepted.ts` does not account for  | `scripts/check-audit.ts` (`bun run security:audit`)          |
| Named exports only                                                                                                                  | `no-restricted-exports`                                      |

When a gate fails, fix the cause. Raising a ceiling or adding an ignore entry
requires a comment saying why, in the config, next to the change.

## Decisions that will look wrong until you know why

Each of these was tried the obvious way first and changed on evidence. Reverting
one without reading the reason will reintroduce a bug that is already fixed.

Two clusters of them live beside the code they govern, so that they load where
they apply rather than in every session: the team report's in
`docs/agents/team-report.md`, for `src/pages/team-hours/`,
`src/entities/team-timelogs/`, `src/entities/teams/` and
`src/widgets/team-manager/`; and the document endpoints' in
`docs/agents/document-endpoints.md`, for `netlify/`, `src/entities/preferences/`
and `src/entities/teams/`. A `CLAUDE.md` in each of those directories imports
its file. Any other agent, and anybody changing the acceptance features or steps
that exercise those screens, reads the file first.

- **The timelog query carries no period, and no `count`/`totalSpentTime`.**
  GitLab truncates `startDate`/`endDate` to UTC calendar dates — verified:
  `startDate: 2026-08-20T16:00:00Z` still matches an entry recorded at
  `15:00:00Z`. So a period asked of GitLab is a window of UTC days, and its
  totals disagree with the days on screen by the hours logged on the boundary
  days. History is read newest first instead, and every period is cut locally
  where the reader's zone is known. See § 4 of
  `openspec/changes/archive/2026-08-31-rebuild-personal-hours-dashboard/design.md`.
- **`totalSpentTime` is a string and `summary` is `''`, not null.** Each is
  normalised at the adapter boundary that reads it — `summary` in `timelogs`,
  `totalSpentTime` in `team-timelogs`. The fixtures in `tests/e2e/support/`,
  `tests/support/gitlab-timelogs.ts` and `tests/support/gitlab-team-timelogs.ts`
  are shaped from a real recorded response for that reason; keep them that way.
- **A period total says whether it is settled.** A total whose loaded history
  does not reach past the period's start is a floor, not an answer, and the query
  keeps loading until it is. Presenting a floor as final would understate the
  reader's hours.
- **The dashboard and insights read a day or a month from the address, and an
  address naming none is never completed.** `/?date=YYYY-MM-DD` and
  `/insights?month=YYYY-MM`, both optional. The team screen redirects an address
  with no team to the remembered one; these deliberately do not, because their
  default is "now" and writing today's date into the address would freeze a
  bookmark on the day it was saved. Absence is a value of its own and keeps
  meaning today after midnight, and choosing today navigates back to the bare
  address, so "now" has one address rather than two. A date after today is
  clamped by the page, not the route: which day is today depends on the
  reader's zone, which only React knows, and resolving it in UTC there would
  turn a São Paulo evening's real today into "tomorrow". Neither choice is
  remembered across visits, for the group filter's reason: the default is the
  honest answer, and a remembered past date would greet the reader with last
  month's figures under a heading they would have to read to notice.
  **The two parsers live in `shared/lib/address.ts`, not beside the pages.** A
  route's `validateSearch` is not code-split, so whatever it imports is in the
  bundle every reader downloads. Imported from `@/pages/dashboard` and
  `@/pages/insights` they took both pages with them — measured, the initial
  load went from 178.19 kB to 200.69 kB against a 180 kB budget. From `shared`
  it is 178.62 kB.
  **The day is picked from a calendar popover, not a date input.**
  `pages/dashboard/ui/day-picker.tsx`, over `shared/ui/calendar.tsx`
  (`@daypicker/react`) in `shared/ui/popover.tsx`. It shipped first as the
  platform's `<input type="date">`, and that was reversed on two counts: the
  native field writes the date in the _browser's_ locale, so an English screen
  on a Brazilian machine read 02/10/2026, and it drew an operating-system
  control in the middle of the app's own, which is the drift `popup.ts` exists
  to stop. The trigger names the day through `Intl` in the app's language, and
  every label the calendar announces comes from Paraglide — its defaults are
  date-fns' English. It also removed a debounce the native field needed: typed
  into, a date input reports a complete date after every segment, so the year
  2025 passed through `0002` on the way, and each one was an instruction to read
  the reader's history back to it. A click is one complete choice.
  The calendar is told every day is UTC midnight and reads its answer back with
  `toIsoDate(date, 'UTC')`, so a picked square is a calendar date and no instant
  crosses a zone on the way in or out. The picker is `lazy()` for the reason the
  team screen's pickers are: the dashboard is the first screen, the budget has
  half a kilobyte left, and the popup machinery hoists into the entry when
  imported eagerly. The month on insights is a stepper because
  `<input type="month">` is a plain text box on desktop Firefox and Safari. The
  controls that would go past today are disabled with `focusableWhenDisabled`,
  so a keyboard reader stepping forward onto today keeps focus on the button
  that took them there.
- **A chosen day's periods settle on the week as well as the month.**
  `periodSummaries` in `entities/timelogs/model/periods.ts`, read by
  `useHoursReport(day)`, which keeps fetching older pages until both are
  settled. The month alone was what it waited on before, and that was already
  short for today: on 2 October 2026 the week began on 28 September, so a first
  page reaching back to the 30th settled October and left the week a floor
  saying "still loading" with nothing loading. One history and one query key
  still serve every day; an earlier period is the same cut over another range,
  read further back. The week strip, the insights sections and the day screen
  each wait on their own period being settled — a week, a month or a day not yet
  reached would otherwise draw as one with nothing logged, which UI-7 forbids.
- **The day feed uses `content-visibility: auto`, not a virtualiser.**
  `@tanstack/react-virtual` was installed, tried and removed: rows expand into
  their work items, and a measured list whose items change height is exactly
  where a virtualiser scrolls the reader somewhere they did not ask to be.
- **A GraphQL answer carrying `data` and `errors` together is used, not thrown
  away.** `GraphQLClient.request` returns both. GitLab answers `200` with the
  entries it could resolve and errors for the rest, and `dataOf` used to throw on
  any `errors` at all — which classified a partly usable answer as `rejected`, a
  kind the query client does not retry, and left a reader's dashboard empty and
  saying "GitLab refused the request" over three entries out of twenty-five. Only
  an answer with no usable data is a failure now.
- **There are two timelog query documents, and the second one is not dead
  code.** `Timelog.project` is non-nullable in GitLab's schema while the
  connection's items are not, so an entry whose project GitLab will not resolve
  for this reader arrives as `null` and takes its hours with it.
  `MY_TIMELOGS_WITHOUT_PROJECT` asks the same page again without that field, so
  the resolver that failed is never reached and the hours can be read.
  `TimelogEntry.project` is nullable because of it. The two answers are
  reconciled by a bounded multiset difference in `model/reconcile.ts` — never by
  position: the requests are not atomic, and on the newest page an entry logged
  between them shifts every index, so a positional merge would count an entry
  twice. The bound makes drift lose an entry at worst, which the report declares,
  rather than invent one, which nothing would.
- **"Short" is not "unsettled".** `settled` (REPORT-3) drives further page
  requests; an entry GitLab withheld and nothing recovered never improves, so
  routing it through that flag would page through the whole history forever. It
  is reported as a count instead.
- **There is no charting library.** The week strip, the heatmap and the project
  split are divs with a width or a background token. Colours come from
  `src/app/charts.css`, validated against this app's own card surfaces in both
  themes; editing a token there means re-validating it.
- **Hour figures use `HourFigure`, never `aria-label`.** Naming is prohibited on
  a generic element, so `aria-label` on a `<span>` is ignored by screen readers
  while Testing Library still computes it — a green suite over a broken figure.
  The component hides the digits from assistive technology and puts the spoken
  form beside them.
- **A section's heading id comes from `useId`.** A hardcoded id works only while
  the section renders once, and `aria-labelledby` breaks silently when it does
  not. Biome's `useUniqueElementIds` enforces this.
- **Every dropdown on the report opens the same panel, out of
  `shared/ui/popup.ts`.** There are two of them and they answer different
  questions: a **combobox** for a list that comes from the provider a page at a
  time and has to be typed at (the group filter, thousands of groups), a
  **select** for a list already in hand and short enough to read (the team
  picker, a reader's own teams). Neither should be built out of the other.
  They still have to look like one control, because they stand next to each
  other on the report's toolbar — and they did not. The team picker was a native
  `<select>`, chosen to avoid spending a floating popup's positioning machinery
  on three items, and that saving was never real: the combobox on the same row
  already loads it, so the pair shared everything except their appearance. What
  the reader got was one control opening the app's panel and the one beside it
  opening the operating system's, in a different font, a different width and a
  different highlight, six pixels apart. The surface, the rows, the list, the
  closed control and its size are five constants both read.
  `/settings` keeps the **native** `SelectField` from `shared/ui` for all three
  of its lists — the time zone, the colour scheme and the language — and that
  is not the same decision reversed: none of them stands beside a popup,
  several hundred zones is a list a custom listbox would have to virtualise to
  stay responsive, and a native select is also the platform's own picker on a
  phone.
  The select needed two corrections Base UI's defaults would have hidden.
  `alignItemWithTrigger` is false, or the panel lays itself over the trigger
  with the chosen row on top — native macOS behaviour, and not what the combobox
  beside it does. And the chevron is rendered plainly rather than through
  `Select.Icon`, which renders "▼" as its own text: the trigger's accessible
  name came out as the team's name with an arrow glued to it, which a screen
  reader reads aloud.
  **Both pickers are `lazy()`, and that is load-bearing rather than tidy.**
  Imported eagerly, Base UI's internals are shared with the button and the input
  every screen already uses, so the bundler hoists the popup machinery into the
  entry chunk: measured, that put the initial load at 214 kB against a 180 kB
  budget. Split, it is 174 kB.
- **Every search box waits 300 ms; no field ever does.** `shared/lib/use-debounced.ts`,
  read by all three provider-backed searches — the person search and the group
  list in the teams dialog, and the group filter on the report. The field
  renders what the reader typed, so it never lags the keyboard; only the query
  reads the settled value. Debouncing the input itself would fight the browser
  over the caret on every settle and make the box feel broken to fix a cost the
  reader cannot see.
  Measured before the fix: `rafael` in the person search was five GraphQL
  requests, `taxplus` in a group search six, and `query-client.ts`'s retry
  policy turns each of those into up to three on a connection that is dropping
  them. TanStack Query does abort the superseded request — the `queryFn`
  destructures `signal`, so losing its last observer cancels the retryer — but
  the request had already been sent and the provider had already paid for it.
  Cancellation bounds concurrency, not volume, and it is not a debounce.
  **Two characters is a floor, not a substitute.** It only ever stopped the
  first request; every keystroke after it still went. The floor stays for its
  own reason — `users(search: "")` is a page of strangers offered as teammates
  — but below it a _group_ search is now the unfiltered list rather than a
  disabled query. That shares one key and one answer with an empty box, so a
  reader who has typed one letter sees every group instead of the empty list
  disabling it used to draw, and it costs no request.
  The two searches carry `placeholderData: keepPreviousData`, so a list stops
  emptying itself between one term and the next. That has a trap worth knowing:
  **a placeholder outlives the `enabled` guard.** The person search therefore
  draws nothing below its own floor rather than reading `data`, or a list of
  people would sit under a box the reader had just cleared.
  Two typed fields are deliberately **not** debounced, and adding one to either
  would be a bug. The weekday targets already settle where it matters — the
  network write waits 800 ms in `use-preferences-sync.ts`, and the per-keystroke
  work left is a `localStorage` write the reader's own screen depends on. The
  team name goes into the draft on every keystroke and reaches the store only on
  Save, so there is nothing to delay.
  Nothing in the unit suite used to type into either search box, so this was
  removable with every gate green. `team-manager.test.tsx` now counts what
  reaches the provider, and both counts fail without the debounce.
- **A day span is found by bisection, not by constructing local midnight.**
  `spanInstantsIn` in `shared/lib/date.ts`. São Paulo advanced its clocks at
  midnight every spring until 2019, so the local day began at 01:00 and 00:00
  never happened; bisecting `toIsoDate` finds the first instant that is in the
  day whatever the zone did. The span ends one **microsecond** before the next
  begins: GitLab compares `spent_at >= ?` and `<= ?`, so spans sharing an
  instant count an entry twice and spans a millisecond apart lose one a day.
- **The OAuth scope is `read_api openid`, and the deployment order is
  load-bearing.** Tick `openid` on the GitLab OAuth application **before**
  deploying the bundle that asks for it; the other order fails every sign-in with
  `invalid_scope`, for everyone, including readers who never open the team
  screen. `openid` confers no authority over data — it is what lets the document
  endpoints (`docs/agents/document-endpoints.md`) learn who is calling without this app vouching for the claim itself. A
  session granted before the scope changed keeps working and is not signed out:
  it authorises everything else it always did, so the reader sees an inline
  reconnect notice on the teams surface — with a button that authorises again
  and comes back to the same address, which `SignInAgainButton` in
  `entities/sessions` is, and which only the read-failure notice carries,
  because a failed write has a draft on screen — and the quiet unsynced line on
  `/settings`, and authorising once more repairs both. Both surfaces degrade to
  what the device itself holds, which is what they showed before any of this
  existed. Signing them out would lose their place for no gain, and saying
  "unavailable" would send them looking for an outage.
- **Faults go to Sentry, in its EU region, through a function on this origin,
  and a report is rebuilt rather than cleaned.** Four constraints chose the tool
  and every one of them is still load-bearing: an initial load at 195.5 kB of a
  196 kB budget (178 kB of 180 kB when the tool was chosen), a policy whose
  `connect-src` is this origin and GitLab, a screen full of other people's names
  and hours, and `bun audit` at zero.
  Measured on errors-only configurations, Sentry's browser client is 21 kB,
  Grafana Faro 40 kB without tree-shaking, PostHog 51–102 kB, and
  OpenTelemetry has no error grouping at all; Sentry's SDK is also the protocol
  Bugsink, GlitchTip and Better Stack accept, so leaving costs a DSN.
  **The reporting code is never in the first load.** `monitoring.ts` listens to
  the window and holds up to ten faults; `monitoring-sdk.ts` is a dynamic import
  on `requestIdleCallback`, falling back to `load`, never a timer. A build with
  no DSN defines it as `""` and the bundler drops the import with the branch, so
  the chunk is not even emitted.
  **A report is rebuilt from an allowlist** in `shared/lib/scrub.ts`, never
  cleaned of fields somebody thought of. Sentry 11 replaced `sendDefaultPii`
  with `dataCollection`, whose defaults collect identities, headers, cookies,
  bodies and GraphQL variables; the client is told to collect none of it, but
  the rebuild is what `scrub.properties.test.ts` proves, by planting generated
  personal values in every field. A message survives only for the app's own
  classes and three engine ones — a `SyntaxError` from `JSON.parse` quotes the
  body it could not read — and `faultOf` hands over a copy of a refusal without
  GitLab's messages. `netlify/lib/scrub.mts` is the same rule for the
  functions, held to the browser's by a contract test, for the reason the
  version header is.
  **The tunnel takes no credential.** A fault on `/login` or the callback is the
  one that locks somebody out, and it happens before there is a credential. A
  DSN is public anyway; what the tunnel adds is invocations, so every refusal
  happens before it fetches anything and the browser stops at twenty reports a
  page. There is no `rateLimit` on it because this plan has none.
  **Route errors are reported from `createRoot`, not the router.** TanStack
  Router calls `defaultOnCatch` only beside an error component; with none, its
  global boundary draws the error and tells nobody. React's `onCaughtError`
  sees it, loader errors included, and nothing drawn changes.
  **The functions use `@sentry/core/server`, not `@sentry/node`**, which is an
  OpenTelemetry instrumentation tree whose automatic half needs a flag a
  function cannot pass. A `503` is an `EndpointFault` made where the endpoint
  gave up, so each site groups on its own, with the store's error — whose
  message can quote the reader's key — as its scrubbed `cause`. The release is
  `netlify/lib/release.json`, written by the build command, because a function
  is not given `COMMIT_REF` at run time.
  **`@sentry/vite-plugin` was installed, measured and removed.** Its debug-ID
  snippet in every chunk took the initial load to 181.43 kB. The maps are
  uploaded by `sentry-cli` under the release and paired by file name, then
  deleted; `build.sourcemap` is `'hidden'` and `drop-source-maps.ts` fails the
  build if a chunk still names one, so no build serves a map.
- **The accessibility sweep waits for the page to stop moving, and the contrast
  gate names the panel every dialog is painted on.** Two halves of one failure.
  `toBeVisible()` is satisfied by a box on screen and says nothing about
  opacity, so the sweep audited the teams dialog part of the way through its own
  100 ms fade: on WebKit, axe reported one list's two rows at 3.58:1 against
  `#0f1413` and 3.62:1 against `#101614` — the same surface, measured twice,
  against two different backgrounds, because the opacity was still climbing
  between the reads. Settled, that pair is 5.96:1. `settle()` in
  `tests/e2e/steps/dashboard.ts` awaits every finite animation before analysing;
  infinite ones are skipped, because `animate-pulse` on a skeleton never
  finishes and awaiting it would hang the audit rather than settle it. This is
  the same lesson as the wait already recorded one step out — `goto` resolves
  before a client-rendered app has painted — and both were found the same way,
  by WebKit.
  It reached `main` green. Playwright retries once in CI and a recovered test
  makes the job pass, so the run that merged the dialog says `2 flaky` and
  nothing else; the branch after it failed only because the retry failed too.
  **A flake on this sweep is worth reading, not re-running.**
  The second half is what the first half hid. `--popover` was the one surface in
  this interface that no pair in `scripts/contrast/pairs.ts` named, while
  carrying the teams dialog, the team picker and the group filter. It was fine —
  every pair now measured clears its floor — but nothing was holding it there,
  and the pair CI was complaining about was the pair the gate did not check. It
  is held to what a card is held to now, eight pairs in both schemes. One of
  them, the solid button against the panel in the dark scheme, clears 3:1 by two
  hundredths; it is recorded rather than rounded off, so the next person to
  retune either token learns it from the gate.
  The sweep's own message changed with them: a violation used to read
  `color-contrast (4 nodes)` and name none of them, which is unreadable from a
  CI log by somebody who cannot open the page. It carries each failing
  element's selector and the two colours axe compared.
- **The audit is two tiers, and only one of them can be excused.**
  `scripts/check-audit.ts`. It was `bun audit` at zero over the whole tree,
  and that held until an advisory arrived with no fix and no way to a reader:
  `braces`, a stack exhaustion from deeply nested glob patterns, installed only
  by the linters and the spec tooling, which expand patterns this repository
  writes. Every gate went red with nothing anybody could do, on every branch at
  once, and a gate that is red for no action teaches people to stop reading
  it. So: `bun audit --prod` — the 92 packages a reader's browser or the
  functions load — stays at zero at any severity with no exceptions at all. The
  rest may carry an advisory only if `scripts/audit/accepted.ts` names it with
  the reason it cannot reach a reader and the day that was checked. The list
  cannot rot quietly: an entry the audit no longer reports fails the gate until
  it is deleted, and one reviewed more than ninety days ago fails it until
  somebody looks again. An upgrade is always the first answer; an entry is for
  when there is no release to upgrade to.
  `--prod` is not in `bun audit --help`, so the gate does not trust it: the
  production run must check strictly fewer packages than the whole tree, or it
  fails as having stopped filtering. Raising the production tier's floor, or
  letting `accepted.ts` excuse a production package, is the change this
  paragraph exists to stop.
- **Vite is patched, by one line, in `patches/vite@8.2.2.patch`.** Before it
  binds, `bun run dev` probes port 3000 on the wildcard addresses with a bare
  `net.Server` and closes it — and `close()` waits for every connection the
  probe accepted. A tab left open on the app is a client polling that port
  every second to reconnect, so a restart with the app open could be accepted
  by the probe and wait on it: measured, 37s and 98s under Node and more than
  four minutes under Bun, which accepts for longer before it reports
  listening; with nothing connected it was 5s. That was the dev server that was
  "sometimes slow". The patch hands the probe a handler that destroys what it
  accepts — the tab's ping fails and retries a second later against the real
  server. Still present in 8.3.2. Upgrading Vite makes `bun install` fail on the
  patch, which is the moment to check whether it is still needed.
- **The compiled messages have one writer per folder.** `src/paraglide/` is
  `locale-modules`, written byte for byte alike by `scripts/compile-messages.ts`
  and by the Vite plugin under `bun run dev`; `vite build` writes
  `message-modules` to `node_modules/.cache/paraglide/build` and reaches it
  through the `@/paraglide` alias. Each used to rebuild what the other had just
  written — `docs/qa/quality-metrics.md` has the measurements.
- **Two linters.** ESLint carries the type-aware, React and testing-library
  rules; Biome carries the ARIA rules and the unique-id rule. Replacing ESLint
  with Biome was measured twice and rejected — `docs/qa/quality-metrics.md` has
  the table.

## Conventions

- **Types**: `strict` plus every optional check (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `erasableSyntaxOnly`, …). No `any`, no
  non-null assertions to silence the compiler.
- **Formatting**: Prettier decides. Never hand-format.
- **Imports**: sorted by `perfectionist`; run `bun run lint:fix`.
- **UI components**: add them with `bunx shadcn@latest add <name>`; they land in
  `src/shared/ui` (style `base-nova`, Base UI primitives). Do not hand-write
  what the CLI generates — with five exceptions, all marked in place:
  `button.tsx` and `input.tsx` carry measured contrast fixes to the invalid
  border, the outline edge, and the solid and quiet hover states, and
  `combobox.tsx`, `dialog.tsx` and `select.tsx` carry corrections to what the generator wrote.
  Regenerating any of them means re-applying those. `bun run a11y:contrast`
  measures the tokens those fixes name, never the classes in `button.tsx` that
  name them, so undoing any of the four still passes `verify` and ships. Anything that opens a list also reads `popup.ts`.
  **The CLI rewrites files it was not asked for, and installs a package that is
  not real.** `shadcn add dialog` overwrote `button.tsx`, dropping every fix
  above; both it and `shadcn add select` wrote `import { cn } from "cn"` and
  installed an unrelated npm package of that name, because the alias in
  `components.json` does not resolve. Read `git diff` after every add: it
  is the only thing that catches either of those.
- **Design tokens**: CSS custom properties in `src/app/styles.css`. Light values
  on `:root`, dark on `.dark`. Never hardcode a colour in a component.
- **Time**: GitLab reports seconds. Convert with `secondsToHours` and accumulate
  in seconds, so rounding never compounds.
- **Dates**: a day is an `IsoDate` (branded `YYYY-MM-DD`) from
  `shared/lib/date`. `toIsoDate` is the only place an instant becomes a day;
  everything after it is calendar arithmetic, which no time zone can get wrong.
  That arithmetic runs on date-fns over a UTC-pinned `TZDate`, so a result never
  depends on the machine's zone — a test would otherwise pass locally and fail
  on a UTC runner. Display goes through `Intl` in `shared/lib/format`, never
  date-fns locales: `Intl` carries the platform's CLDR data, so "21 de agosto de
  2026" comes out right without a hand-written pattern per language.
- **Switching language remounts the tree.** Compiled messages are plain
  functions, so a component that renders one without also reading the locale
  context would keep the old language. `LocaleProvider` keys its subtree on the
  locale to force the whole thing to render again; anything whose state must
  survive a language switch belongs outside it.
- **Commits**: Conventional Commits, enforced by commitlint on commit-msg and
  again in CI on every commit a pull request brings — the release notes are
  built from them.
- **Branches and pull requests**: `CONTRIBUTING.md` is the flow, and an agent
  follows it too. A change branches from `staging` and its pull request goes
  **into `staging`**; only `staging` (a promotion) and `hotfix/*` may open one
  into `main`, and the `branch-policy` check refuses anything else. Merge
  commits only. Every merge into `main` is a tagged release computed from the
  commits, so there is no version to bump anywhere by hand.

## Tests

- `features/domain/*.feature` — business rules, run by `@amiceli/vitest-cucumber`
  with step definitions in `tests/domain/`.
- `features/acceptance/*.feature` — user flows in a real browser, run by
  `playwright-bdd` with step definitions in `tests/e2e/steps/`, including
  `axe-core` accessibility assertions.
- `src/**/*.test.ts(x)` — unit and component tests, co-located.
- `*.properties.test.ts` — property tests with `fast-check`, beside the
  examples for the same module: a rule stated for every input, checked against a
  few hundred generated ones, with the smallest failing input printed when one
  breaks it. Where a rule holds for any answer or any zone — the reconciliation
  never inventing an entry, a day span never overlapping the next — state it
  there as well as by example. OpenSSF Scorecard counts them as fuzzing.
- `netlify/**/*.test.mts` — both document endpoints' rules, in the `functions`
  project: node, no DOM, and no Netlify. The blob store and the identity verifier
  are ports, so these inject an in-memory store and a locally minted key pair
  rather than reaching for `getStore`, which throws outside a Netlify
  environment. The acceptance suite serves a static `dist/` with no function
  behind it, so this is the only place the credential rules are proved.
- Every `Scenario` carries a `# Spec: <capability> / <requirement>` comment
  linking it back to the OpenSpec requirement it covers, and `bun run arch:trace`
  fails if one is missing or if a requirement has no scenario. A requirement no
  browser can observe goes in that script's `UNCITED_BY_DESIGN` map with the
  reason, never silently.

Coverage: 90% overall on authored logic, **100% on `model/`**. Mutation score on
`model/` must stay above 85%.

**Coverage is a floor, not a target.** Outside `model/` the last few branches are
not chased: a test written to reach a branch the type system makes unreachable
asserts nothing a reader cares about. `docs/qa/quality-metrics.md` records every
gate, its target, where it is enforced, and why coverage alone is not the
quality signal here — the `aria-label` bug had 100% coverage over it.

`docs/qa/` also holds the test plan, the manual regression pass, the browser
matrix, the screen-reader procedure, the release checklist and the promotion pull
request's body.

## Planning

Changes are planned with OpenSpec (`openspec/`) before they are implemented:
proposal → specs → design → tasks. Use the OpenSpec CLI, not hand-edited files.

Never create issues or epics in any tracker without being asked.
