The scaffold and every quality gate already exist on this branch (`chore: scaffold
v2 with the full quality toolchain`). These tasks build the product on top of it.

Throughout: `bun run verify && bun run test` must pass before a task is
considered done, and each task below names whatever additional gate proves it.

## 1. Shared kernel

- [x] 1.1 Add `src/shared/config/env.ts` parsing `VITE_GITLAB_CLIENT_ID` and optional `VITE_GITLAB_BASE_URL` with zod, exposing a typed config and a distinguishable "not configured" result; verify unit tests cover a missing id, a blank id and a trailing slash on the base URL
- [x] 1.2 Add `src/shared/lib/date.ts` — day extraction, week and month boundaries and weekday index for an instant in a given IANA time zone, using `Intl.DateTimeFormat` only; verify unit tests cover a DST transition, an entry either side of midnight in `America/Sao_Paulo`, and an unrecognised zone
- [x] 1.3 Add `src/shared/lib/format.ts` — locale-aware hour, date and weekday formatting built on `Intl`; verify unit tests assert the `en` and `pt-BR` output for the same values, including the decimal separator (I18N-4)
- [ ] 1.4 (moved to group 6, its only consumer) Add `src/shared/lib/result.ts` — a small tagged result type for adapter boundaries so failures are values rather than thrown strings; verify unit tests cover mapping over both arms
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

- [ ] 7.1 Add the shadcn components these screens need via `bunx shadcn@latest add`; verify `bun run deadcode` reports no unused component afterwards
- [ ] 7.2 Load the chart palette guidance and define the chart colour tokens in a dedicated stylesheet; verify the tokens are defined for both themes and referenced by no hardcoded colour
- [ ] 7.3 Build `widgets/kpi-row` — today, this week, this month, each with progress against target and a zero state; verify component tests cover a period with nothing logged reading as zero rather than missing (UI-2)
- [ ] 7.4 Build `widgets/week-strip` — one bar per weekday against its target, today marked, hours readable without interaction, and an accessible text alternative naming hours and target; verify component tests cover a met target, a shortfall and the announced text (UI-1, UI-8)
- [ ] 7.5 Build `widgets/day-feed` — reverse-chronological, virtualised, extending on scroll, with skeletons sized to the final row height; verify component tests cover appending without the list jumping and the end-of-history state (UI-3, UI-9)
- [ ] 7.6 Build the day row's expansion into work items with project, reference, title, hours and an external link that preserves the current view; verify component tests cover the listed hours summing to the day total, an unattributed entry and the link target (UI-4, UI-10)
- [ ] 7.7 Distinguish loaded-and-empty from not-yet-loaded from failed in every list and tile; verify component tests assert the three states render differently (UI-7)
- [ ] 7.8 Compose `pages/dashboard` from the widgets with the period selector in the URL and prefetch on hover or focus of the period controls; verify a test asserts a prefetch is issued on intent
- [ ] 7.9 Add the `/days/$date` route rendering the same detail as a page and as a drawer from the feed, including a no-time-logged state; verify tests cover reload on the address and a day with no entries (UI-5)

## 8. Insights and settings

- [ ] 8.1 Build `widgets/month-heatmap` distinguishing days with time, working days without time, and days outside the month; verify component tests cover all three (UI-6)
- [ ] 8.2 Build `widgets/project-split` for hours per project over the period; verify a component test asserts the split sums to the period total
- [ ] 8.3 Build `widgets/top-items-table` on TanStack Table, sortable by hours; verify a component test asserts the busiest item sorts first (UI-6)
- [ ] 8.4 Compose `pages/insights`, importing the chart components lazily; verify `bun run build && bun run size` shows the chart library outside the initial chunk and the budget still met
- [x] 8.5 Compose `pages/settings` for daily target per weekday, time zone, language and theme, with validation messages; verify component tests cover rejecting an out-of-range target and applying a new time zone (PREF-2, PREF-3)

## 9. Responsiveness and accessibility

- [ ] 9.1 Review every screen at a 375-pixel viewport, moving wide content into its own scroll container; verify an acceptance assertion confirms no horizontal page scrolling at that width (UI-11)
- [ ] 9.2 Verify keyboard operability end to end with a visible focus indicator on every interactive element; verify an acceptance scenario tabs through the dashboard and asserts focus is always visible (UI-8)
- [ ] 9.3 Extend the axe assertions to every route in both themes; verify `bun run test:e2e` reports no violation (UI-8)

## 10. Acceptance suite and QA documents

- [ ] 10.1 Transcribe the remaining dashboard scenarios into `features/acceptance/` — viewing the week, inspecting a day, browsing history, switching language and theme, configuring the daily target — each citing its requirement id; verify `bun run test:e2e` runs them all
- [ ] 10.2 Assert Web Vitals in the acceptance suite: first contentful paint and cumulative layout shift thresholds on the dashboard, cold and warm; verify the suite fails when a threshold is exceeded
- [ ] 10.3 Write `docs/qa/test-plan.md` — strategy, levels, what each level is responsible for and what it deliberately does not cover
- [ ] 10.4 Write `docs/qa/regression-checklist.md` — the manual pass before a release, covering sign-in, sign-out, token expiry, period switching, language, theme and a deep link
- [ ] 10.5 Write `docs/qa/browser-matrix.md` — the browsers and viewports covered automatically and the ones checked by hand
- [ ] 10.6 Write `docs/qa/accessibility-audit.md` — the manual screen-reader and keyboard procedure that automated axe checks cannot replace
- [ ] 10.7 Write `docs/qa/release-checklist.md` — including the OAuth redirect URI and the Netlify environment variable, whose absence only shows at sign-in
- [ ] 10.8 Update `docs/qa/quality-metrics.md` with the measured values at the end of this change
- [ ] 10.9 Assert in the acceptance suite that a returning reader sees the previously loaded figures before any request resolves, and that signing out empties the persisted cache (REPORT-8, AUTH-6)

## 11. Deployment and CI

- [ ] 11.1 Add `netlify.toml` — build command, publish directory, Bun version, the `/* -> /index.html 200` fallback and a strict Content-Security-Policy allowing connections only to the GitLab origin; verify a deploy preview resolves a hard refresh on `/days/2026-08-20` and that sign-in works against the preview origin
- [ ] 11.2 Add `.gitlab-ci.yml` running format, lint, typecheck, architecture, dead code, type coverage, audit, tests with coverage, build with the size budget and the acceptance suite as blocking stages; verify the first pipeline passes
- [ ] 11.3 Add the scheduled non-blocking pipeline for mutation testing; verify it reports a score and does not block a merge request
- [ ] 11.4 Report the GitLab shared-runner identity validation prompt if the first pipeline hits it, since only the account owner can clear it

## 12. Closing the change

- [ ] 12.1 Cross-check correctness against reality: the last-30-days total for the signed-in account must match the value captured during research — 122.3 hours across 30 entries — and the two most recent entries must match what GitLab shows for the same period
- [ ] 12.2 Run the full gate set — `bun run verify`, `bun run test:coverage`, `bun run test:e2e`, `bun run test:mutation`, `bun run build && bun run size` — and record the results
- [ ] 12.3 Rewrite `README.md` and `AGENTS.md` to describe the delivered app rather than the scaffold, including the data flow
- [ ] 12.4 Confirm every `.feature` scenario cites a requirement id and every requirement id is cited by at least one scenario
