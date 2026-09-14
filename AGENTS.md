# AGENTS.md

Personal dashboard of hours logged in GitLab issues and merge requests. Read
`README.md` for setup and the GitLab OAuth application it needs.

**Everything in this repository is written in English** — code, comments, commit
messages, documentation, Gherkin features. User-facing strings never appear as
literals; they live in `messages/{en,pt-BR}.json` and reach the UI through
Paraglide.

## Commands

| Command                           | What it does                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `bun run dev`                     | Dev server on http://localhost:3000                                                                                         |
| `bun run verify`                  | Every fast gate: format, lint, ARIA, contrast, translations, types, architecture, dead code, type coverage, vulnerabilities |
| `bun run test`                    | Unit, component and Gherkin domain tests (`domain` + `ui` Vitest projects)                                                  |
| `bun run test:coverage`           | Same, with coverage thresholds enforced                                                                                     |
| `bun run test:e2e`                | Builds, serves `dist/`, runs Playwright over `features/acceptance/*.feature` — chromium locally, three engines in CI        |
| `bun run test:mutation`           | Stryker mutation testing on the model layer                                                                                 |
| `bun run build` && `bun run size` | Production build, its Content-Security-Policy, and the 180 kB gzip budget                                                   |
| `bun run arch:trace`              | Every scenario cites a requirement, and every requirement is cited                                                          |
| `bun run lint:a11y`               | Biome, ARIA rules only                                                                                                      |
| `bun run a11y:contrast`           | Every colour pair that has to stay legible, measured against both schemes                                                   |
| `bun run i18n:check`              | Every message exists in every language, and no message exists in only one                                                   |

Run `bun run verify && bun run test` before calling any change finished.

### Runtime

Bun is the package manager, script runner and runtime. Two exceptions, both
deliberate and both marked in `package.json`:

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

Everything else uses `bun --bun`. `bunfig.toml` is deliberately absent: a global
`[run] bun = true` symlinks `node` to Bun, which silently breaks the three tools
above.

## Architecture

Feature-Sliced Design on the outside, Clean Architecture inside each slice.

```
src/
  app/          router, providers, global styles, and routes/ (TanStack Router
                file-based routing lives inside the app layer, because route
                files are wiring). `lib/runtime.ts` builds the session manager,
                the timelog gateway and the data client once, from one
                configuration read — it hands out the client rather than a third
                gateway, so a screen most readers never open keeps its adapter
                out of the bundle everybody downloads;
                `lib/query.ts` builds the cache and its persister. The
                signed-in header lives in `routes/_authenticated.tsx`, so the
                guard that proves there is a session is the same thing that
                decides the chrome exists.
  pages/        screen composition. A block with one consumer lives here rather
                than in widgets/, which is what steiger requires.
    dashboard/    the KPI row, the week strip, the day feed and their derivations
    day-detail/   one day, addressable
    insights/     the month heatmap, the project split, the top-items table
    settings/     the preference fields
    team-hours/   a group’s month as a person × day matrix, its controls and
                  its notices
    login/, auth-callback/, not-configured/
  widgets/      composed blocks with more than one consumer
    hours-report/ the query, the report and the status notice — used by the
                  dashboard and by the day screen
  features/     single user interactions (theme/)
  entities/     domain slices (plural names, kept consistent by steiger)
    timelogs/
      model/    PURE business rules and ports. No React, no I/O, no strings.
      api/      adapters: the GitLab GraphQL gateway, zod schemas, query options
      ui/       the gateway provider
      index.ts  public API — import from here, never from internals
    sessions/     PKCE, credentials, the OAuth adapter and the token stores
    viewers/      who is signed in, on its own query so a screen that wants a
                  name does not load a season of hours to get one
    preferences/  daily target, time zone, theme choice
    group-timelogs/ one group’s month: the widened window, the roster union, the
                  grid, the shortfall measured against GitLab’s own totals, and
                  the column probe that puts a withheld hour on its own day
  shared/       ui (shadcn plus ours), api (the GraphQL client, the query client
                and the cache persister), lib, i18n, config
scripts/        build and gate tooling: the CSP writer, the traceability check,
                the contrast measurement, the translation-parity check, and the
                message compiler, which every `pre*` script calls and which
                rebuilds only when the catalogues change
```

`model/` and `api/` are FSD's own segment names; they carry the Clean
Architecture meaning: `model` is the domain layer, `api` is the infrastructure
adapter. Both linters recognise them, which custom names like `domain/` and
`infra/` would not.

### Rules that are enforced, not suggested

| Rule                                                                                                                                | Enforced by                                           |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| A layer imports only from layers below it                                                                                           | `boundaries/dependencies` (`config/eslint/layers.js`) |
| Slice public API, no cross-slice imports, no layer skipping                                                                         | `steiger` (`bun run arch:layers`)                     |
| No import cycles, no orphan modules, no devDependency in `src/`                                                                     | `dependency-cruiser` (`bun run arch:graph`)           |
| `model/` stays pure: no React, no `@tanstack/*`, no `api/`, no i18n, no `fetch`/`window`/`localStorage`                             | `DOMAIN_PURITY_RULES` (`config/eslint/layers.js`)     |
| Shipped code never imports `node:*`                                                                                                 | `BROWSER_ONLY_RULES`                                  |
| Cyclomatic complexity ≤ 8, cognitive complexity ≤ 10, ≤ 40 lines per function (60 for components), ≤ 200 lines per file, ≤ 3 params | `config/eslint/limits.js`                             |
| No unused export, file or dependency                                                                                                | `knip` (`bun run deadcode`)                           |
| ARIA attributes are supported by the role they sit on                                                                               | `biome` (`bun run lint:a11y`)                         |
| Every colour pair stays above its contrast floor, in both schemes                                                                   | `scripts/check-contrast.ts` (`bun run a11y:contrast`) |
| Every message exists in every language                                                                                              | `scripts/check-messages.ts` (`bun run i18n:check`)    |
| ≥ 99% of expressions carry a real type                                                                                              | `type-coverage`                                       |
| Zero dependency vulnerabilities, at any severity                                                                                    | `bun audit`                                           |
| Named exports only                                                                                                                  | `no-restricted-exports`                               |

When a gate fails, fix the cause. Raising a ceiling or adding an ignore entry
requires a comment saying why, in the config, next to the change.

## Decisions that will look wrong until you know why

Each of these was tried the obvious way first and changed on evidence. Reverting
one without reading the reason will reintroduce a bug that is already fixed.

- **The timelog query carries no period, and no `count`/`totalSpentTime`.**
  GitLab truncates `startDate`/`endDate` to UTC calendar dates — verified:
  `startDate: 2026-08-20T16:00:00Z` still matches an entry recorded at
  `15:00:00Z`. So a period asked of GitLab is a window of UTC days, and its
  totals disagree with the days on screen by the hours logged on the boundary
  days. History is read newest first instead, and every period is cut locally
  where the reader's zone is known. See `design.md` § 4.
- **`totalSpentTime` is a string and `summary` is `''`, not null.** Both are
  normalised at the adapter boundary. The fixtures in `tests/e2e/support/` and
  `tests/support/gitlab-timelogs.ts` are shaped from a real recorded response for
  that reason; keep them that way.
- **A period total says whether it is settled.** A total whose loaded history
  does not reach past the period's start is a floor, not an answer, and the query
  keeps loading until it is. Presenting a floor as final would understate the
  reader's hours.
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
- **The group report asks for a period; the personal one still does not.** They
  read the provider differently on purpose. `startDate`/`endDate` are truncated
  to UTC calendar days — that is `TimelogResolver#parse_datetime_args` calling
  `beginning_of_day` — but `startTime`/`endTime`, when both are given, are passed
  to the query untouched. So a bounded month is askable. It is still asked one
  whole UTC day wider at each end and cut locally by `entriesWithin`: rounding
  can only move a start earlier and an end later, so the answer stays a superset
  of the reader's month under every reading of the range, and the same cached
  answer stays right if the reader changes time zone. Never send `startTime`
  with `endDate` — `validate_args!` permits that pair and it silently truncates
  one end only.
- **A group figure is checked against GitLab's own count, not against nothing.**
  `TimelogConnection.count` and `totalSpentTime` are computed in SQL over the
  whole unpaginated relation, _before_ `remove_unauthorized` deletes the entries
  the reader may not read from the node array — silently, with no null and no
  error. The difference between the two is the only instrument that can see that
  removal at all, and `timelogs(username:)` makes it per person, which is what
  lets a row say it is short rather than the footer say the group is. The
  difference is reported **signed**: a withheld correction makes the figures too
  high, and clamping at zero would turn that into "nothing is missing".
- **The grid is handed the whole window and cuts the month itself.** It needs two
  answers out of one set of entries, and they are not over the same span. The
  cells, the roster union and every total on screen are the reader's month. The
  per-person shortfall is not: it is measured against what the provider declared,
  and the provider declared over the window it was asked about, which is the month
  widened by a day at each end. Cutting before the grid — which is what it used to
  do — compared a declaration over the window against hours drawn for the month,
  and so reported every hour logged on a padding day as an hour withheld from the
  reader. A person who logged eight hours on 31 August had "+8 h hidden" against
  their September row. It is exact this way round because a connection's
  aggregate and its nodes are the same relation under the same range: whatever the
  provider took the range to mean, the two agree, so their difference is the
  removal and nothing else.
- **There is no `user`-recovery document, and there should not be.** The obvious
  mirror of `MY_TIMELOGS_WITHOUT_PROJECT` is unreachable: `TimelogType#user`
  resolves through a batch loader whose default is the Ghost user, and
  `read_user` is enabled for any authenticated caller, so a node nulled by an
  unresolvable `user` cannot happen. An earlier draft carried one, along with a
  permanent `person: null` branch through the whole model that no real answer
  could produce.
- **A cell past the read frontier is `pending`, and that beats `logged`.** Pages
  arrive oldest first, so until a column has been read to its end more entries
  may still land in it. Showing what has arrived so far would put a figure that
  is about to change next to somebody's name — and for the twenty seconds a
  large group takes to page, "logged nothing" beside a real colleague is the
  worst thing this screen could say.
- **Bars on the team screen measure against a stated constant, not the reader's
  own target.** Eight hours Monday to Friday, named in the legend. Using the
  reader's `dailyTarget` would draw a part-time teammate's every day as visibly
  short, which is an assertion about somebody else's working arrangement that
  this app has no basis for. Over the reference is drawn as the bar crossing a
  dashed rule rather than changing colour: `charts.css` records that brass
  against brick collapses under deutan, which is exactly the pair a colour-coded
  version would have used.
- **A row is for figures; whoever has none is named under the table.** The
  roster union still puts everybody in the report — that is what tells "logged
  nothing" apart from "not in this group", and every total is computed before
  anything is dropped. What the screen leaves out is the row: thirty-one dashes
  between two lines of figures cost a reader scanning across more than they
  tell them. Two rows survive having no figures anyway. A person whose hours the
  provider counted and would not show keeps theirs, because the row is what says
  which days the shortfall belongs to. And nobody is dropped until the month has
  been read in full, since until then "logged nothing" is only "not read yet".
- **A weekend column is drawn from `share`, not from the cell's kind.** A cell is
  only `non-working` once its column has been read and nobody logged in it, so a
  weekend still loading — or one later this month — would lose its tint and its
  narrow width, and the table would change shape as the pages landed. `share` is
  null exactly when the reference expects nothing, which is the fact the column
  is drawn from. The widths live in a `<colgroup>`: a fixed table takes its
  widths from the first row, and the first row here is the week bands, whose
  cells span several columns and say nothing about any one of them.
- **The chosen group is remembered, and the address still wins.** `lib/remembered.ts`
  keeps the path — never a figure, which `persist: false` forbids — so a return
  visit does not begin by picking your own team out of a list. An address that
  names a group is never overridden, because a link somebody sent outranks this
  reader's habit; one that names none is completed by **redirecting** rather than
  by filling the screen in behind it, so what you are looking at stays what you
  can send somebody else.
  (A second control, naming a wider group to read and a narrower one to draw, was
  built and reverted. It answered a real question — a squad member logging in a
  sibling squad — but two group pickers on one screen is a price the answer did
  not justify. The group filter is the group filter.)
- **The key lists only the marks the table uses.** A legend entry for something
  that is nowhere on screen sends the reader hunting for it, and finding nothing
  is indistinguishable from having missed it. Read off the grid in
  `pages/team-hours/lib/legend.ts`. The reference bar is always listed: it
  explains every figure there is.
- **No sentence on the team screen says somebody logged nothing.** Every figure
  there comes from `group(fullPath:) { timelogs }`, which GitLab scopes to that
  group and its descendants through `Timelog.in_group` — so an hour logged on an
  issue in another group is not missing from the answer, it was never asked for.
  The cells used to read "No time logged", which is a claim about a person made
  from a measurement of a group, and a reader who reaches the table by landmark
  never passes the subtitle that qualified it. Every one of those strings now
  names the group, and the table caption carries the scope so it is announced
  where the figures are. Widening the scope is possible — `user(username:) {
timelogs }` is the same resolver with a User parent, and it is the only door,
  since the root `Query.timelogs` refuses any username but your own — but it
  would cost the screen its instrument: `count`/`totalSpentTime` on a
  user-parented connection is computed before redaction and would publish the
  volume of work in namespaces the reader cannot open (gitlab-org/gitlab#425747).
  Without it, every total on the screen would be collected rather than checked.
- **The sync control carries no caveats.** It answers three questions — when the
  hours arrived, whether they are arriving now, whether asking failed — and owns
  the screen's one status region. Sentences about what a figure could not include
  were appended to it and read as part of the sync state: announced on every
  refresh, and nowhere near the number they were about. They live on the row now.
  The reader's own access level is not explained at all: it is not something the
  screen measured, it does not change between visits, and it is not what somebody
  opened a month of hours to find out.
- **A withheld hour is added into its cell, not drawn beside it.** `model/withheld.ts`
  replaces the cell's figure with the provider's own total for that day and
  rebuilds every total from the summed cells, so the rows, the columns and the
  corner still agree. `share` is recomputed with it — a bar still drawn against
  the visible hours under a figure that grew would be the one mark on the screen
  disagreeing with the number beside it. The cell says what part of itself cannot
  be opened only to assistive technology: a bracketed second figure was tried and
  read as clutter, but a screen that folds an unreadable hour into a number and
  says nothing at all is vouching for something it cannot open.
- **Withheld hours are placed by asking the same aggregate one column at a
  time.** The entries are unrecoverable and always will be: `TimelogType`
  carries `authorize :read_issuable`, and a node the reader may not read is
  spliced out of the array — no id, no `spentAt`, nothing to recover. But
  `count` and `totalSpentTime` resolve over the finder relation _after_ the time
  filter and _before_ that removal, so the same instrument that says "3 h are
  missing from this month" says "3 h are missing from the 11th" when asked over
  one day. Asking is conditional on `shortfall.entryCount !== 0`, which the
  per-person probe already answers for free, so a group with nothing withheld
  costs no extra request at all. One request per short row, capped at six.
  A whole grid is not askable: each alias costs 7 of GitLab’s 250-point
  complexity budget, so 31 columns plus the period check is 224 and fits, while
  31 x 40 scores over eight thousand and is refused before it reaches the
  database.
- **A placement is checked before it is drawn, and refusing costs only the
  marks.** `model/withheld.ts` requires the columns to account for the period
  exactly, no column to declare fewer entries than were shown in it, and the
  period to declare at least what the row draws. The first of those is what sees
  the provider reading a span differently from this app: rounded-out spans
  overlap and the sum comes in high, a span a millisecond short leaves a gap and
  it comes in low. Every check is on entry counts, never seconds, because counts
  cannot cancel — an entry and its correction net to zero seconds and remain two
  entries. No hour on screen depends on any of it: the figures still come from
  entries the pages carried, cut in the reader’s zone, and a refused placement
  leaves the row saying hours are missing without saying where.
- **A day span is found by bisection, not by constructing local midnight.**
  `spanInstantsIn` in `shared/lib/date.ts`. São Paulo advanced its clocks at
  midnight every spring until 2019, so the local day began at 01:00 and 00:00
  never happened; bisecting `toIsoDate` finds the first instant that is in the
  day whatever the zone did. The span ends one **microsecond** before the next
  begins: GitLab compares `spent_at >= ?` and `<= ?`, so spans sharing an
  instant count an entry twice and spans a millisecond apart lose one a day.
- **The team report is never written to the device.** Its queries carry
  `meta: { persist: false }` and `__root.tsx` reads that rather than a key it has
  to recognise. The reader's own hours are persisted because that is what paints
  a return visit before any request; a group's belong to other people, and a
  shared machine must not keep them.
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
  what the CLI generates — with two exceptions, both marked in place and both
  measured: `button.tsx` and `input.tsx` carry contrast fixes to the invalid
  border, the outline edge, and the solid and quiet hover states. Regenerating
  either component means re-applying them. Three of the four are held by
  `bun run a11y:contrast`, so undoing them fails `verify` rather than shipping.
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
- **Commits**: Conventional Commits, enforced by commitlint on commit-msg.

## Tests

- `features/domain/*.feature` — business rules, run by `@amiceli/vitest-cucumber`
  with step definitions in `tests/domain/`.
- `features/acceptance/*.feature` — user flows in a real browser, run by
  `playwright-bdd` with step definitions in `tests/e2e/steps/`, including
  `axe-core` accessibility assertions.
- `src/**/*.test.ts(x)` — unit and component tests, co-located.
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
matrix, the screen-reader procedure and the release checklist.

## Planning

Changes are planned with OpenSpec (`openspec/`) before they are implemented:
proposal → specs → design → tasks. Use the OpenSpec CLI, not hand-edited files.

Never create issues or epics in any tracker without being asked.
