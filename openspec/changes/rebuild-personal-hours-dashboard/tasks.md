The scaffold and every quality gate already exist on this branch (`chore: scaffold
v2 with the full quality toolchain`). These tasks build the product on top of it.

Throughout: `bun run verify && bun run test` must pass before a task is
considered done, and each task below names whatever additional gate proves it.

## 1. Shared kernel

- [x] 1.1 Add `src/shared/config/env.ts` parsing `VITE_GITLAB_CLIENT_ID` and optional `VITE_GITLAB_BASE_URL` with zod, exposing a typed config and a distinguishable "not configured" result; verify unit tests cover a missing id, a blank id and a trailing slash on the base URL
- [x] 1.2 Add `src/shared/lib/date.ts` — day extraction, week and month boundaries and weekday index for an instant in a given IANA time zone, using `Intl.DateTimeFormat` only; verify unit tests cover a DST transition, an entry either side of midnight in `America/Sao_Paulo`, and an unrecognised zone
- [x] 1.3 Add `src/shared/lib/format.ts` — locale-aware hour, date and weekday formatting built on `Intl`; verify unit tests assert the `en` and `pt-BR` output for the same values, including the decimal separator (I18N-4)
- [x] 1.4 Dropped, not moved. The tagged result type had no consumer once the adapter landed: `graphQLClient` throws a `GraphQLRequestError` carrying a `GraphQLFailure` union, TanStack Query catches it, and the screen reads the `kind` to decide what to say. A `Result` in between would be a layer that nothing asks for, and `knip` would report it as unreachable — correctly
- [x] 1.5 Add the en and pt-BR message entries for every string these tasks introduce as they are introduced, never as a later pass; verify `bun run build` fails when an entry is missing from one catalogue (I18N-5)
- [x] 1.6 Add `src/features/theme` with the pre-paint resolution already inlined in `index.html`, a provider owning the same state, and a toggle; verify component tests cover system-follows, explicit override, and reacting to a system change while no override is stored (PREF-4, PREF-5)
- [x] 1.7 Add `src/features/locale` with a language switcher wired to Paraglide and persistence; verify component tests cover switching without reload and restoring the stored choice (I18N-3)
- [x] 1.8 Set the document language from the active locale; verify an acceptance assertion reads the root `lang` attribute in both languages (I18N-6)

## 2. Preferences model

- [x] 2.1 Write the failing tests for `entities/preferences/model` — daily target per weekday with the 8h weekday / 0h weekend default, period target as the sum of its days, and rejection of a negative or greater-than-24h target; then implement (PREF-1, PREF-2)
- [x] 2.2 Write the failing tests for preference decoding — unknown time zone falls back to the default, malformed stored value falls back to defaults, storage access denied falls back to defaults; then implement (PREF-3, PREF-6)
- [x] 2.3 Add `entities/preferences/api` persisting through a storage port, with an in-memory implementation used by tests; verify the model tests need no browser storage
- [x] 2.4 Transcribe the preference scenarios into `features/domain/daily-target-and-balance.feature` with `# Spec:` citations; verify `bun run test` runs them
- [x] 2.5 Confirm `bun run test:mutation` still reports 100% on `model/` after this group

## 3. Session model

- [x] 3.1 Write the failing tests for `entities/session/model/pkce.ts` — verifier length within 43..128 and drawn only from the unreserved set, verifier uniqueness across calls, and the `S256` challenge matching a known verifier/challenge pair from RFC 7636; then implement (AUTH-2)
- [x] 3.2 Write the failing tests for token lifetime arithmetic — when a credential is due for renewal, and treating a missing or past expiry as due now; then implement (AUTH-5)
- [x] 3.3 Define the `AuthGateway` and `TokenStore` ports in `entities/session/model`; verify lint confirms the model imports no adapter and touches no browser global
- [x] 3.4 Transcribe the PKCE scenarios into `features/domain/pkce-challenge-generation.feature`; verify `bun run test` runs them

## 4. Session adapter and screens

- [x] 4.1 Implement `entities/session/api/gitlab-oauth.ts` — authorize URL construction, code exchange, renewal and revocation as form-encoded requests with no client secret; verify MSW-backed tests cover success, a denied authorization and a rejected renewal (AUTH-1, AUTH-6, AUTH-9)
- [x] 4.2 Implement the token stores: access token in memory only, refresh token in `localStorage` replaced atomically on rotation; verify a test asserts nothing is written to any persistent storage for the access token (AUTH-3, AUTH-4)
- [x] 4.3 Implement single-flight renewal shared by concurrent callers; verify a test fires several concurrent unauthorized requests and asserts exactly one renewal call reaches the gateway (AUTH-5)
- [x] 4.4 Add the `/login` page and the sign-in action; verify a component test asserts there is no token input anywhere on it (AUTH-1)
- [x] 4.5 Add the `/auth/callback` route performing the exchange, validating `state`, consuming the verifier and reporting failure; verify tests cover a mismatched `state`, a callback with no pending request and a replayed callback (AUTH-2)
- [x] 4.6 Add the route guard that redirects to sign-in and restores the originally requested destination afterwards; verify a test opens a day deep link while signed out and asserts the post-sign-in destination (AUTH-8)
- [x] 4.7 Implement sign-out: revoke, clear both stores, reset the query cache and the persisted cache; verify tests cover the happy path and revocation failing while local state is still cleared (AUTH-6)
- [x] 4.8 Transcribe the sign-in scenarios into `features/acceptance/sign-in-with-gitlab.feature` driven against a stubbed authorize endpoint; verify `bun run test:e2e` runs them

## 5. Timelog model

- [x] 5.1 Extend `entities/timelogs/model` with the day-bucketing rule: group entries by calendar day in a given time zone, and keep only the entries inside a requested range once converted; write the failing tests first, covering an entry on either side of midnight and a range edge (REPORT-4)
- [x] 5.2 Write the failing tests for per-day aggregation — total per day, breakdown per work item with two entries on the same item merged, and unattributed time counted and labelled; then implement (REPORT-5, REPORT-7)
- [x] 5.3 Write the failing tests for period totals — accumulate in seconds and convert once, so a period total equals the sum of its days' durations exactly; then implement (REPORT-2, REPORT-3)
- [x] 5.4 Write the failing tests for balance against target — per day, per week and per month, including a weekend day with logged time counting as above target; then implement (PREF-1)
- [x] 5.5 Define the `TimelogGateway` port in `entities/timelogs/model`; verify lint confirms the model imports nothing from `api/`
- [x] 5.6 Transcribe the aggregation and time-zone scenarios into `features/domain/aggregate-hours-by-day.feature` and `features/domain/timezone-day-boundaries.feature` with `# Spec:` citations
- [x] 5.7 Verify `bun run test:coverage` reports 100% on `model/` and `bun run test:mutation` stays at or above 85%

## 6. Timelog adapter and queries

- [x] 6.1 Add `src/shared/api/graphql.ts` — a typed `fetch` wrapper for `POST /api/graphql` that attaches the bearer credential, surfaces GraphQL errors, and distinguishes unauthorized from unavailable; verify MSW tests cover a payload error, a 401 and a network failure (REPORT-9)
- [x] 6.2 Add the zod schemas for the timelog response in `entities/timelogs/api`; verify a test asserts an unexpected shape fails with a message naming the offending field
- [x] 6.3 Implement `gitLabTimelogGateway` issuing the `currentUser.timelogs` query newest first, with no group or project filter and — as the live API forced — no `startDate`/`endDate`, since GitLab truncates both to UTC calendar dates; verify tests assert the request variables and the absence of a scope filter and of a period (REPORT-1, REPORT-3)
- [x] 6.4 Capture MSW fixtures shaped from the real response recorded during research, including an entry with no work item and a merge request entry; verify the fixtures type-check against the zod schemas
- [x] 6.5 Add the `useInfiniteQuery` options under one key for the whole history, paging on `pageInfo.endCursor`, and derive every period from the loaded entries with a `settled` flag saying whether the period is fully retrieved; verify tests assert the cursor handling, the settling rule and that a month keeps loading until settled (REPORT-3, REPORT-6)
- [x] 6.6 Add the IndexedDB query-cache persister with a 5-minute `staleTime` and 24-hour `gcTime`, and clear it on sign-out; verify tests assert the throttled write, the restore, the removal and that a browser refusing storage is survived. Painting from the cache before any request resolves is asserted in the browser, in task 10.9 (REPORT-8, AUTH-6)
- [x] 6.7 Wire error and retry behaviour so a failed refresh keeps cached figures on screen alongside the failure; verify component tests cover refresh-fails-with-cache and retry re-requesting the same period (REPORT-8, REPORT-9)

## 7. Dashboard

- [x] 7.1 Add the shadcn components these screens need via `bunx shadcn@latest add`; verify `bun run deadcode` reports no unused component afterwards
- [x] 7.2 Load the chart palette guidance and define the chart colour tokens in a dedicated stylesheet; verify the tokens are defined for both themes and referenced by no hardcoded colour
- [x] 7.3 Build the KPI row — today, this week, this month, each with progress against target and a zero state; verify component tests cover a period with nothing logged reading as zero rather than missing (UI-2)
- [x] 7.4 Build the week strip — one bar per weekday against its target, today marked with `aria-current`, hours readable without interaction, and an accessible name giving hours and target; verify component tests cover a met target, a shortfall, a weekend without a target and the announced text (UI-1, UI-8)
- [x] 7.5 Build the day feed — reverse-chronological, extending as the reader approaches the end and by an explicit control for anyone not scrolling, with skeletons sized to the final row height. Rows carry `content-visibility: auto` instead of a virtualiser: they expand into their work items, and a measured list whose rows change height is where a virtualiser makes the list jump. Verify component tests cover appending without replacing, the end-of-history state and the observer contract (UI-3, UI-9)
- [x] 7.6 Build the day row's expansion into work items with project, reference, title, hours and an external link that preserves the current view; verify component tests cover the listed hours summing to the day total, an unattributed entry and the link target (UI-4, UI-10)
- [x] 7.7 Distinguish loaded-and-empty from not-yet-loaded from failed in every list and tile; verify component tests assert the three states render differently (UI-7)
- [x] 7.8 Compose `pages/dashboard` from the blocks above. No period in the URL and no prefetching: the request carries no period, so every screen reads the one newest-first cache entry and opening a day costs no request at all. The single-consumer blocks live inside the page slice rather than in `widgets/`, which is what steiger requires of a block with one reference
- [x] 7.9 Add the `/days/$date` route rendering the same detail as a page and as a drawer from the feed, including a no-time-logged state; verify tests cover reload on the address and a day with no entries (UI-5)

## 8. Insights and settings

- [x] 8.1 Build the month heatmap distinguishing days with time, working days without time, and days outside the month; verify component tests cover all three, and that a day is measured against its own weekday target rather than a fixed eight (UI-6)
- [x] 8.2 Build the project split for hours per project over the period, keyed by full path so two projects sharing a name stay apart; verify tests assert the split sums to the period total and that the shares sum to one
- [x] 8.3 Build the top-items table on TanStack Table 9, sortable by hours, project, item or the number of days an item kept coming back; verify tests assert the busiest item leads without being asked and that sorting reverses it (UI-6)
- [x] 8.4 Compose `pages/insights`. There is no chart library to import lazily — the heatmap is a CSS grid and the split is CSS bars, which is lighter than any charting runtime and leaves the accessible text under our own control; the route is its own chunk, so TanStack Table stays out of the initial one. Verified: 14.3 kB gzip for the insights chunk, 114.6 kB initial against the 180 kB budget
- [x] 8.5 Compose `pages/settings` for daily target per weekday, time zone, language and theme, with validation messages; verify component tests cover rejecting an out-of-range target and applying a new time zone (PREF-2, PREF-3)

## 9. Responsiveness and accessibility

- [x] 9.1 Review every screen at a 375-pixel viewport; verify an acceptance outline asserts no horizontal page scrolling at that width on all four signed-in screens. The header wraps onto a second row rather than overflowing, which is what 40 pixels of overflow on every screen turned out to be (UI-11)
- [x] 9.2 Verify keyboard operability end to end with a visible focus indicator on every interactive element; verify an acceptance scenario walks focus through the dashboard, reads the computed style at each stop and asserts an outline or ring is drawn, and that the walk reaches the day feed (UI-8)
- [x] 9.3 Extend the axe assertions to every route in both themes as one outline; verify `bun run test:e2e` reports no violation. Biome now also checks ARIA statically, which caught what axe did not: `aria-label` on a generic element, and hardcoded ids behind `aria-labelledby` (UI-8)

## 10. Acceptance suite and QA documents

- [x] 10.1 Transcribe the remaining dashboard scenarios into `features/acceptance/` — viewing the week, inspecting a day, browsing history, switching language and theme, configuring the daily target — each citing its requirement id; verify `bun run test:e2e` runs them all
- [x] 10.2 Assert cumulative layout shift under 0.1 on the dashboard, cold and warm. Paint timing is deliberately not asserted: the suite runs against the dev server, where a paint time measures the dev server. Layout shift is a layout property and holds in either mode; download size is guarded by the `size-limit` budget instead
- [x] 10.3 Write `docs/qa/test-plan.md` — strategy, levels, what each level is responsible for and what it deliberately does not cover
- [x] 10.4 Write `docs/qa/regression-checklist.md` — the manual pass before a release, covering sign-in, sign-out, token expiry, period switching, language, theme and a deep link
- [x] 10.5 Write `docs/qa/browser-matrix.md` — the browsers and viewports covered automatically and the ones checked by hand
- [x] 10.6 Write `docs/qa/accessibility-audit.md` — the manual screen-reader and keyboard procedure that automated axe checks cannot replace
- [x] 10.7 Write `docs/qa/release-checklist.md` — including the OAuth redirect URI and the Netlify environment variable, whose absence only shows at sign-in
- [x] 10.8 Update `docs/qa/quality-metrics.md` with the measured values at the end of this change
- [x] 10.9 Assert in the acceptance suite that a returning reader sees the previously loaded figures before any request resolves — and, since the cache is fresh for five minutes, that no request is made at all — and that after signing out the next sign-in starts empty. REPORT-8 is amended: a warm return inside the freshness window refreshes nothing, so there is nothing to mark as refreshing (REPORT-8, AUTH-6)

## 11. Deployment and CI

- [x] 11.1 Add `netlify.toml` and generate the Content-Security-Policy into `dist/_headers` after the build, since it names the hash of the inline theme script. Verified locally by serving the real bundle with the policy applied and driving sign-in, the dashboard, insights, settings and a theme switch: no violations, so `style-src 'self'` holds. The deploy-preview checks are in `docs/qa/release-checklist.md`
- [x] 11.2 Add `.gitlab-ci.yml` running the whole fast gate, the tests with coverage, the build with the size budget and the acceptance suite as blocking stages. `glab ci lint` accepts it; the first real pipeline is verified on the push
- [x] 11.3 Add the scheduled mutation job — `rules: schedule` and `allow_failure: true`, so a merge request never waits for it and never fails on it
- [x] 11.4 No identity validation was asked for: the shared runner picked the first pipeline up and ran it. What did fail was mine, four times over — the `prepare` script needing git in an image without it, `BUN_INSTALL_CACHE_DIR` unpacking dependencies where `prettier --check .` walks, a dev server slower than Playwright's default minute in a cold container, and no `.env` on a runner. All four are recorded in `docs/qa/quality-metrics.md`. Pipeline green in 6.9 minutes: verify 87s, test 66s, e2e 273s, build 51s

## 12. Closing the change

- [x] 12.1 Cross-check correctness against reality. The account has logged more time since the research figure of 122.3 hours over 30 entries, so the invariant was checked instead of the number: the live payload was fetched with `glab`, parsed by the real zod schema and run through `reportFrom`, and our 784 080 seconds — 217.8 hours over 62 entries and 30 days — equals GitLab's own `totalSpentTime` exactly
- [x] 12.2 Run the full gate set — `bun run verify`, `bun run test:coverage`, `bun run test:e2e`, `bun run test:mutation`, `bun run build && bun run size` — and record the results
- [x] 12.3 Rewrite `README.md` and `AGENTS.md` to describe the delivered app rather than the scaffold, including the data flow
- [x] 12.4 Confirm every `.feature` scenario cites a requirement id and every requirement id is cited by at least one scenario. Made a gate rather than a one-off: `bun run arch:trace` fails in both directions, and the four requirements no browser can observe are listed with their reasons. 41 requirements, 37 cited by scenarios

## 13. Revision: the ledger palette and the sign-in screen

Asked for after the change was delivered: the sign-in screen looked unfinished and
carried two paragraphs that explained nothing, and the slate-and-indigo palette was
the most generic combination in software. A design pitch offered three directions;
the chosen one is the split-screen sign-in of one, with the palette of another.

- [x] 13.1 Rename the product to `GitLab Dashboard` everywhere it is the product's
      name — both catalogues, the document title, the README, the package manifest
      and the lockfile — and nowhere it is domain vocabulary. `secondsToHours`, the
      `hours-report` slice, `Hours per weekday` and the twenty-odd other matches on
      "hours" stay: the app is about hours, and two of those strings are asserted by
      a green suite. The OpenSpec change directory keeps its name, which describes
      what was done rather than what the product is called
- [x] 13.2 Delete `sign_in_description` and `sign_in_no_token_notice` from both
      catalogues and rebuild the screen as a split: the mark, a claim and the day
      feed drawn as an illustration on one side, the heading and the single button
      on the other. No spec requirement had to change — AUTH-7 locates the read-only
      claim in the authorization request and in GitLab's account settings, never on
      this screen — and the unit test that asserted the removed prose was deleted
      rather than rewritten against something else (AUTH-1, AUTH-8)
- [x] 13.3 Render the application shell's header only while signed in, and give the
      sign-in screen its own colour-scheme control, since it is the only one a reader
      has before signing in. Guard `/login` against a reader who already has a
      session, which would otherwise put two identical controls on one page (PREF-4)
- [x] 13.4 Re-derive both stylesheets for the ledger palette rather than recolouring
      them: 109 interface pairs and 48 chart pairs measured, the ordinal ramp and the
      categorical set re-run through the palette validator against the new card
      surfaces. Two values could not follow the pitch — the dark accent is a step
      lighter than `#9e2b33`, which measures 2.60:1 against the dark ground, and the
      focus ring is ink, because at 50% alpha no oxblood or brass ring can reach 3:1
- [x] 13.5 Fix two contrast defects the re-derivation exposed in the generated
      components, both older than this revision: the outline button's edge used the
      divider token at 1.25:1 where a control boundary needs 3:1, and the dark
      invalid border was drawn at 50% alpha, which caps at 5.26:1 over a card even
      in pure white and measured 2.63:1. Both deviations from what the shadcn CLI
      writes are commented in place, so regenerating does not silently revert them
- [x] 13.6 Add the missing 375-pixel scenario for the sign-in screen. UI-11 says
      every screen, and the outline covered only the four signed-in routes, so a
      full-bleed two-column layout that overflowed on a phone would have shipped
      green (UI-11)
- [x] 13.7 Act on an adversarial review of the whole revision: six independent
      lenses raised 39 findings, a verifier refuted 18, and the 21 that survived
      became the fixes below. The ones worth naming: the contrast numbers in the
      token comments were partly wrong, so they are gone and
      `scripts/check-contrast.ts` measures 76 pairs on every `verify`;
      `scripts/check-messages.ts` makes the catalogue-parity claim in
      `check-traceability.ts` true instead of crediting a lint rule nobody wrote;
      the size budget was reading 2 of the 10 files `index.html` requests; and
      signing out could hang forever on a revocation with no timeout, leaving the
      reader looking signed out on a screen full of their own hours (AUTH-6)
- [x] 13.8 Fix the four defects that were older than this revision and would not
      have been found without it: the sign-in button latched itself disabled and
      said nothing when `startSignIn` rejected (AUTH-9); the KPI progress bar was
      built from interface tokens and measured 2.69:1 on dark; the acceptance
      fixture counted days in UTC, so the suite failed every evening after 21:00
      in Brazil; and Playwright's default worker count over-subscribed the one
      Vite dev server every browser shares, failing 25 scenarios for its own
      reasons. All four are recorded in `docs/qa/quality-metrics.md`

## 14. The dashboard greets the reader

- [x] 14.1 Add `entities/viewer`: a gateway that reads `currentUser { name }`, its
      own query keyed apart from the hours and stale after a day, and a pure
      `greetingNameOf` that takes the first word of the name and returns nothing
      rather than a greeting with a hole in it. The name is deliberately NOT read
      from the timelog query: the settings screen wants a name and no hours, and
      the two must not drag each other's refetches (UI-12)
- [x] 14.2 Greet above the day's heading on the dashboard, reserving the line's
      height whether or not a name has arrived — it sits above a heading, so
      appearing late would push the whole screen down and UI-9 says loading does
      not move the page (UI-12, UI-9)
- [x] 14.3 Teach the acceptance stub to answer both queries by reading the request.
      Handing the hours payload to the viewer query would fail its schema and
      greet nobody, silently — the same class of defect as a green suite over a
      broken figure

## 15. Making the gates worth waiting for

- [x] 15.1 Run the acceptance suite against the built bundle on its own port
      rather than the dev server on 3000. Measured on one machine, all three
      engines: 358s at two workers against the dev server, 128s at eight against
      the build. The server no longer transforms modules per request, which is
      what had forced the worker count down — and the suite now exercises the
      artefact that deploys
- [x] 15.2 Run chromium locally and the three-engine matrix in CI. A local run is
      for the change in front of you; nothing ships unverified, because the
      pipeline still runs all three
- [x] 15.3 Fix the date assertion that only held on Saturdays and Sundays:
      `\p{L}+` does not match the hyphen in `segunda-feira`, so the step passed
      for a week and failed the first Monday it saw
- [x] 15.4 Guard `i18n:compile` behind a fingerprint instead of dropping the
      `pre*` chain. Every entry point still asks for it and still works on a fresh
      clone — nothing is invoked differently — but asking twice now costs a hash
      rather than a rewrite of 184 files. Output verified byte-identical to the
      command line's. Steady state on the three gates that carry the hook: 38s
      without, 28s with
- [x] 15.5 Re-measure the parallel gate runner now that nothing writes while the
      others read. 33s against 29s in series: no advantage, because six of the
      gates build a TypeScript program of their own. Rejected a second time, on
      evidence rather than on the first attempt's race
