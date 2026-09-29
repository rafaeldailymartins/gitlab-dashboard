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

| Command                           | What it does                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `bun run dev`                     | Dev server on http://localhost:3000, with both document endpoints served by `config/vite/api-dev.ts`                        |
| `bun run verify`                  | Every fast gate: format, lint, ARIA, contrast, translations, types, architecture, dead code, type coverage, vulnerabilities |
| `bun run test`                    | Unit, component, Gherkin domain and serverless-function tests (`domain` + `functions` + `ui` Vitest projects)               |
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
      index.ts  public API — import from here, never from internals
    sessions/     PKCE, credentials, the OAuth adapter and the token stores
    viewers/      who is signed in, on its own query so a screen that wants a
                  name does not load a season of hours to get one
    preferences/  daily target, time zone, theme choice
    team-timelogs/ one team’s month, read through a `User` parent: the widened
                  window, the grid, the shortfall measured against GitLab’s own
                  totals, the column probe that puts a withheld hour on its own
                  day, and the suggestions a team is seeded from
    teams/        the lists of people the reader keeps — the document, its
                  gateway to the endpoint below, and the edits in progress
  shared/       ui (shadcn plus ours), api (the GraphQL client, the query client
                and the cache persister), lib, i18n, config
netlify/        the two document endpoints: `functions/{teams,preferences}.mts`
                name a document and nothing else, and `lib/` holds everything
                worth testing — the endpoint body they share, the handler under
                it and its credential rules, each document's own shape, the
                identity verifier, the blob store and the in-memory one the
                tests and `bun run dev` use
config/         eslint/ (the layer, purity and limit rules) and
                vite/api-dev.ts, which serves that same handler under
                `bun run dev` in thirty lines rather than a platform emulator
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

| Rule                                                                                                                                | Enforced by                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| A layer imports only from layers below it                                                                                           | `boundaries/dependencies` (`config/eslint/layers.js`)        |
| Slice public API, no cross-slice imports, no layer skipping                                                                         | `steiger` (`bun run arch:layers`)                            |
| No import cycles, no orphan modules, no devDependency in `src/` or `netlify/`                                                       | `dependency-cruiser` (`bun run arch:graph`, over both trees) |
| `model/` stays pure: no React, no `@tanstack/*`, no `api/`, no i18n, no `fetch`/`window`/`localStorage`                             | `DOMAIN_PURITY_RULES` (`config/eslint/layers.js`)            |
| Shipped code never imports `node:*`                                                                                                 | `BROWSER_ONLY_RULES`                                         |
| Cyclomatic complexity ≤ 8, cognitive complexity ≤ 10, ≤ 40 lines per function (60 for components), ≤ 200 lines per file, ≤ 3 params | `config/eslint/limits.js`                                    |
| No unused export, file or dependency                                                                                                | `knip` (`bun run deadcode`)                                  |
| ARIA attributes are supported by the role they sit on                                                                               | `biome` (`bun run lint:a11y`)                                |
| Every colour pair stays above its contrast floor, in both schemes                                                                   | `scripts/check-contrast.ts` (`bun run a11y:contrast`)        |
| Every message exists in every language                                                                                              | `scripts/check-messages.ts` (`bun run i18n:check`)           |
| ≥ 99% of expressions carry a real type                                                                                              | `type-coverage`                                              |
| Zero dependency vulnerabilities, at any severity                                                                                    | `bun audit`                                                  |
| Named exports only                                                                                                                  | `no-restricted-exports`                                      |

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
- **The team report asks for a period; the personal one still does not.** They
  read the provider differently on purpose. `startDate`/`endDate` are truncated
  to UTC calendar days — that is `TimelogResolver#parse_datetime_args` calling
  `beginning_of_day` — but `startTime`/`endTime`, when both are given, are passed
  to the query untouched. So a bounded month is askable. It is still asked one
  whole UTC day wider at each end and cut locally by `entriesWithin`: rounding
  can only move a start earlier and an end later, so the answer stays a superset
  of the reader's month under every reading of the range, and the same cached
  answer stays right if the reader changes time zone. One day of slack is always
  enough, because no IANA offset exceeds fourteen hours. Never send `startTime`
  with `endDate` — `validate_args!` permits that pair and it silently truncates
  one end only. The connection this hangs from moved from a group to each
  person; `model/window.ts` did not change with it, because the widening is
  about how the provider reads a range and not about whose hours are inside it.
- **A team figure is checked against GitLab's own count, not against nothing.**
  `TimelogConnection.count` and `totalSpentTime` are computed in SQL over the
  whole unpaginated relation, _before_ `remove_unauthorized` deletes the entries
  the reader may not read from the node array — silently, with no null and no
  error. The difference between the two is the only instrument that can see that
  removal at all, and a `User`-parented connection makes it per person, which is
  what lets a row say it is short rather than the footer say the team is. The
  difference is reported **signed**: a withheld correction makes the figures too
  high, and clamping at zero would turn that into "nothing is missing".
  `username:` is gone from both documents: the connection under `users(ids:)` is
  already one person's, which also removes the one place a period aggregate and
  a column aggregate could have disagreed about who they were about.
  This paragraph used to end by ruling the widening out, and it was wrong. The
  argument was that `count` on a user-parented connection is computed before
  redaction and would publish the volume of work in namespaces the reader cannot
  open (gitlab-org/gitlab#425747), so widening the scope would cost the screen
  its instrument and leave every total collected rather than checked. It is the
  other way round: the figure that survives redaction is the only thing a total
  can be checked against, and on this screen it is deliberately also the answer —
  a reader who chose these people asked how many hours they logged, and an hour
  they cannot itemise is still an hour they are owed a number for. The
  instrument did not survive the widening by luck; it is what the widening runs
  on. It also got stronger in the move: the group shape asked the aggregates in
  a second document (`GroupMonthProbe`), so the count and the nodes it judged
  were read at two instants, while `TEAM_HOURS_PAGE` asks both on the same field
  of the same request, where the aggregate and the nodes are one relation under
  one range and cannot disagree at all.
- **The group filter goes through all three documents and all three query keys,
  or through none of them.** `TEAM_HOURS_PAGE`, `teamHoursFollowing` and
  `teamColumnProbe` each take `$group: GroupID`, and `queries.ts` puts `groupId`
  in every key beside the month and the roster. Leaving it out of one of them is
  the worst bug this screen can have, because nothing on it would look wrong: an
  instrument measuring a wider set than the figures reports hours withheld that
  were merely filtered out, an instrument measuring a narrower set reports none
  when some are, and both numbers are plausible. Leaving it out of a key is the
  same failure through the cache — the reader narrows the scope and is shown the
  previous answer. There is no partial state to get right here; there is one
  argument threaded to the end or nothing.
- **One request carries the whole team, aggregates included.** GraphQL
  complexity counts fields in the document, not rows in the answer, so
  `users(ids:)` with one `timelogs` field under it costs the same whatever the
  roster's length: measured, 26 points of the 250-point budget for one person
  and 29 for sixteen. The group shape needed `1 + ceil(E/100) + ceil(P/32) + <=6`
  requests and was dominated by a serial page walk that every row waited on.
  Two things follow. `users.pageInfo.hasNextPage` is read only to refuse — the
  page size is the batch's own length, so a true there means the provider capped
  the team, and a report that quietly omitted a colleague is worse than one that
  fails. And continuing is a separate document: a node's cursor cannot travel
  back through `users(...)`, because each connection under a node has its own
  cursor space and the parent field has no argument reaching into it. That one
  is bounded by complexity rather than by taste — one alias scores 17, sixteen
  score 227, twenty-four score 339 and are refused — so the batch is sixteen.
  Seventeen fits at 241 and leaves nine points, which is not enough to absorb a
  field somebody adds later.
- **The grid is handed the whole window and cuts the month itself.** It needs two
  answers out of one set of entries, and they are not over the same span. The
  cells and every total on screen are the reader's month. The per-person
  shortfall is not: it is measured against what the provider declared,
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
  arrive oldest first, so until a day has been read past, more entries may still
  land in it. Showing what has arrived so far would put a figure that is about
  to change next to somebody's name, and "logged nothing" beside a real
  colleague is the worst thing this screen could say.
  The frontier is **per person**, not per report: each row is its own
  connection, so a month that fitted one round is final while somebody else is
  still being read, and `frontierOf` in `model/report.ts` is computed from that
  person's own newest entry. `TeamReport.complete` is the only thing that waits
  on everybody, because it is the one figure that is about the whole team.
  The frontier is the day _before_ the newest entry read, since the next round
  can still carry more of that same day.
- **Bars on the team screen measure against the reader's own working schedule,
  and the legend says so.** The `dailyTarget` from Settings, per weekday, passed
  by `useTeamReport` as the grid's `reference`. This reverses a constant — eight
  hours Monday to Friday — chosen so the screen would not assert a part-time
  teammate's every day as short on the strength of the reader's contract. The
  argument assumed the reader's target describes the reader alone; the person
  who opens this screen leads the team on it, and their schedule is the only
  statement anywhere in the app of what a full day is where they work. The
  constant replaced it with a schedule nobody chose, and a lead with a six-hour
  Friday read every Friday as short one screen away from where they had said
  otherwise. What survived is the honesty half: the reference is stated. The
  legend names no number of hours, since a per-weekday schedule has none; it
  says each bar is measured against the day's target. The reference is applied after
  the entries are read and is in no query key, so editing it redraws the month
  and refetches nothing. `REFERENCE_SCHEDULE` is now `EIGHT_BY_FIVE` in
  `tests/support/`, the schedule the rules are exercised against. Over the
  reference is drawn as the bar crossing a dashed rule rather than changing
  colour: `charts.css` records that brass against brick collapses under deutan,
  which is exactly the pair a colour-coded version would have used.
- **Every person on the team keeps a row, including one who logged nothing.**
  This is the reverse of what the group report did, and the reason reversed with
  it. There, the rows came from a roster union — group membership plus whoever
  logged — so a row with thirty-one dashes was usually somebody the provider
  had put in the answer and the reader had never asked about, and dropping it
  cost a reader scanning across nothing they wanted. Here the reader typed the
  roster. An empty row is not clutter that arrived with the answer, it is the
  answer: they picked that person, and "nothing this month" is a fact about
  somebody they are watching, which is the whole reason they added them. Dropping
  it would also make the team and the table disagree about who is on it — the one
  thing a reader can check this screen against without leaving it. `teamGrid`
  maps `request.members` straight to rows and drops nobody; there is no union
  left to compute, because the provider is asked about these people and no
  others.
- **A team is built from whoever logged time in a group, not from its
  membership, and building it is one action.** Membership is an access-control
  list, and it answers a different question. Measured on one real squad: it
  offered seventeen names, eleven of which had no hours at all, while eight
  people had logged in the window and two of those were not members. So the
  people come from a trailing **30 days** of timelogs, read to a cap of **four
  pages**. Neither number is said on screen and both are in the code: a group is
  a _template_, so what the starter promises is that the reader can change who is
  on the team, not how far back the provider was read. That sentence was the
  difference between "nobody logged here" and "nobody logged here lately" while
  the reader picked names out of a list; there is no list — one click later they
  are looking at the team. The notice that said a busy group may have been read
  short went with it, for the same reversal: a census that might be short is a
  serious claim about a list that _is_ the answer and a mild one about a starting
  point being edited in front of you. What covers both bounds now is the search,
  which reaches anybody the provider knows, logged or not, and sits under the
  team rather than behind a control. `SuggestionAnswer.partial` is still computed
  and still tested at the cap — the fact stops at `useGroupSeeding`, which is the
  cheapest way to be able to say it again.
  Those two numbers were ninety days and ten pages, and both were cut for the
  same reason: the read is strictly sequential — each page needs the last page's
  cursor — so the window and the cap multiply directly into how long somebody
  waits looking at nothing, to learn a dozen names out of a thousand entries.
  What thirty days loses is somebody away for the whole month, and they are one
  search away by name.
  Naming the group **is** making the team: it is minted already full, in one
  conditional write. It used to be a combobox in the editor followed by a plus
  beside each person, which asked the reader to re-answer, one name at a time and
  one write at a time, the question they had already answered by naming the
  squad. The same list is reachable afterwards as "add from a group", which
  merges and never removes — a refresh that reconciled both ways would take off
  the colleague the reader added by hand. The team keeps the group's **name** and
  no reference to it, because a stored path is a second thing that can go stale
  and an invitation to exactly the resubscription GROUP-15 forbids.
  Candidates are deduplicated by the provider's identifier, never by username,
  for the reason a roster is stored that way: a username is released on a rename
  and the same person under two of them would be added twice. Bots are dropped
  — nobody manages a bot's timesheet. Accounts that are no longer active are
  **kept**, which looks like the same clutter and is its opposite: somebody who
  logged time in the window did the work and has since been blocked or left, and
  their hours are still in the month the reader is reading. Nothing renders that
  flag any more — there is no list of candidates to mark — and `SuggestedMember`
  carries it all the same, because it is what makes "an inactive account is not
  dropped" a claim a test can fail on rather than a rule that holds until
  somebody writes the filter.
- **The teams dialog is saved on purpose, and the report follows what was
  saved.** `lib/use-team-draft.ts` collects every edit and writes once; the
  footer offers Save and Cancel, and dismissing with anything unsaved asks
  first. This reverses `use-team-edits.ts`'s own argument — that clicks
  collected into a draft are clicks lost to a closed tab, and that "unsaved" is
  an awkward thing to explain on a surface whose whole job is a list — and that
  argument is still true. What outweighed it is that save-on-edit made every
  click final: removing a colleague had no way back but finding them again by
  name.
  It also removed a defect that was nothing to do with taste. `apply` built each
  write from the list as it was last read and closed over the etag read with it,
  with no mutation scope, so two quick edits were both built on the list before
  either. Measured against a store that holds writes open: two removals from a
  team of three sent `etags = ["1","1"]` and `sizes = [2,2]` — the second
  reverting the first, and against the real endpoint refused 409 with the notice
  blaming the reader's own two clicks on somebody else. One write from one
  snapshot cannot do that.
  **A refusal is two different things and they owe the reader opposite answers.** A
  store that could not be reached changed nothing, so the edits stay on screen
  to try again. A conflict did change something — the list moved underneath —
  and TEAM-5 is that the reader sees whose it is now, so that is the one refusal
  allowed to take the edits away.
  The draft is state and nothing else. Not the query cache, which the report
  behind reads — a draft there would repaint the month under the reader and make
  Cancel a problem of putting it back. And not the device: TEAM-2 forbids a
  roster reaching storage, and the acceptance suite reads `localStorage`,
  `sessionStorage` and every IndexedDB store by content looking for exactly that.
  Two things had to change with it. The name field committed on blur and on
  Enter, so a Save while it held text dropped the rename silently; every letter
  goes into the draft now, and it follows the team during render so discarding
  puts the name back. And a group read is up to four sequential pages that
  resolve into whatever is being edited — it carries an era token now, so a read
  the reader discarded while it was in the air is dropped rather than rebuilding
  the draft they threw away.
  **Saving and cancelling both close; only a dismissal asks.** Each of the two
  buttons says what to do about the edits and there is nothing left to do here
  afterwards, so keeping the surface open would be asking the reader to dismiss
  it twice. Cancel is never disabled, because it is the way out as much as it is
  the way to undo. A dismissal — Escape, the backdrop, the close control — says
  only that the reader wants out and not what should become of what they typed,
  so that is the one path that asks. A refused save does not close: there is
  something left to read and something left to do.
  One consequence, and it was followed through: **there is no "Saved." any
  more.** The surface it lived on is gone by the time it would have said so, so
  the closing is the confirmation. It survived one commit as a state a browser
  could not reach, which is a branch every reader of `SaveState` has to rule out
  for themselves — the arm, the string in both catalogues and the acceptance step
  that read it are all deleted. What `SaveNotice` says now is only what the
  reader is still there to hear: that a save is in flight, that it was refused,
  or that somebody else wrote first.
  The question about closing is an inline bar in the footer, not a nested
  dialog: a focus trap inside a focus trap is what the keyboard sweep would find.
  It is not a live region either — `SaveNotice` is this surface's only one, and
  the acceptance suite reads it with an unscoped status locator that resolves to
  a single element only because the dialog hides the report's own.
- **The report's address follows the save, and there were two ways it went
  blank.** `pages/team-hours/lib/address-after-save.ts`. The picker's trigger drew
  with no text at all whenever the address named a team the reader did not have:
  `chosenTeam` answers `unknown`, `teamOf` gives null, and the select is handed
  a value matching no item. Two ways in, and only one is what it looks like. A
  remembered identifier that names nothing — `rememberTeam` is called from one
  place, inside a navigation, so deleting a team never forgot it and the next
  visit was redirected into a dead address; **GROUP-20 already forbade this** and
  nothing implemented it, which `arch:trace` never noticed because it matches
  requirement ids and GROUP-20 is cited by two other scenarios. And deleting the
  addressed team inside the visit, which touches nothing remembered at all.
  Neither is fixed by falling back to the first team, which GROUP-14 forbids: an
  address naming a team that was never yours has to say so. The save is the
  event instead — it is the only moment the list is known to have changed and to
  have been accepted — and the team it moves to is read from the **written
  document**, never from what the dialog minted. `withTeam` returns the list
  unchanged at `MAX_TEAMS` and on a duplicate id while the write still succeeds
  and still says "Saved.", so a minted identifier would name a team nothing
  created.
- **The teams a reader keeps are edited in a dialog over the report, and `/teams`
  is gone.** This reverses the decision the surface shipped with, and that
  decision was sound about the wrong thing: the accessibility and 375 px sweeps
  do address screens by URL, there was no dialog primitive in `shared/ui`, and
  `/settings` is a real precedent for a place the app's own state is edited.
  Every clause of that is still true and none of it is a reason to take the
  reader off the figures. Settings are edited once, from anywhere, with nothing
  on screen depending on them; a team is edited _because of what the report in
  front of you shows_, and the report is where you were going back to. The
  surface never had an address worth sending anybody — it is one reader's private
  list, which is why the route carried no search parameters — so the navigation
  bought the interruption and nothing else. The sweeps did not lose it: `SCREENS`
  in `tests/e2e/steps/keyboard.ts` reaches "teams" by the report's address plus
  one click, which is where a focus trap and a 375 px overflow actually live.
- **The report's controls are one row of `h-9` strips, named by `aria-label`.**
  Four controls sat at three different heights, two of them under stacked labels
  and the fourth an underlined text link, so `items-end` was aligning things that
  were never the same shape. The visible labels were the worst of it and they
  were also redundant: a `select` and a `combobox` both take an accessible name
  from `aria-label` — which is what the assistive tree reads and what
  `getByLabel` finds — while the label above restated what the control's own
  value already says. The way into the teams dialog is an icon button **inside
  the team control's own border**: a control that acts on the thing beside it
  belongs attached to it, and at the end of a row of unrelated controls it read
  as a fifth filter. (This paragraph described it as an icon button inside the
  team control's own border for a while after it had stopped being one; it is a
  labelled button at the far end of the row, and `report-toolbar.tsx` argues
  that case itself.)
- **Every dropdown in the app opens the same panel, out of
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
  `entities/preferences` keeps the **native** `SelectField` for the time zone,
  and that is not the same decision reversed: several hundred zones is a list a
  custom listbox would have to virtualise to stay responsive, and a native
  select is also the platform's own picker on a phone.
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
- **The teams dialog's chunk is fetched before it is clicked.** Code-splitting it
  was right and it made the first open a network request the reader was waiting
  through: measured on the built bundle served locally, 525 ms and two requests,
  and 2.5 seconds on a machine six times slower, with an 850 ms task parsing it.
  So the button starts the import on `pointerenter` and on `focus`, and the
  report screen starts it again from `requestIdleCallback` — which is skipped
  where there is none rather than replaced by a timer that would race the
  month's own requests. Warm, the same open is 21 ms on a normal machine.
  What is left is the page behind it being laid out again: 248 ms at six times
  slower over the month's table against 112 ms over `/settings`, which is the
  scroll lock changing the document's width and a month-wide fixed table with
  sticky cells re-measuring inside it. That is the dialog's price for locking the
  page, and it is paid once per open rather than per frame.
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
  team name saves on blur or Enter, never on a keystroke, so there is nothing to
  delay.
  Nothing in the unit suite used to type into either search box, so this was
  removable with every gate green. `team-manager.test.tsx` now counts what
  reaches the provider, and both counts fail without the debounce.
- **A column nothing is expected of is drawn from `share`, not from the cell's
  kind, and it is named like every other column.** "Nothing expected" means the
  reader's working schedule is zero for that weekday — not that it is a Saturday
  or a Sunday: a Saturday with hours in Settings is a working column, and a
  Wednesday without is tinted. A cell is only `non-working` once its column
  has been read and nobody logged in it, so such a column still loading — or one
  later this month — would lose its tint and its narrow width, and the table
  would change shape as the pages landed. `share` is null exactly when the
  reference expects nothing, which is the fact the column is drawn from. The
  widths live in a `<colgroup>`: a fixed table takes its widths from the first
  row, and the first row here is the week bands, whose cells span several columns
  and say nothing about any one of them.
  Those columns used to carry the date alone, on the argument that one nobody is
  expected to log in is half as wide as the others and has no room for the
  weekday's abbreviation — and that the tint said which day it was anyway. The
  second half was false: the tint says _a_ day expects nothing, never which one,
  so a reader counting across a month had two columns in every seven to work out.
  The width was this table's own choice, so the width moved rather than the
  label: `w-11` against `w-12`, still narrow enough that a month reads as five
  weeks rather than as thirty-one stripes.
  The tint runs through the footer too. It did not, and the stripe stopped one
  row short of the bottom — along the row a reader's eye actually travels, which
  is the one place the break showed. It can be both tinted and `sticky` because
  `--chart-empty` is opaque; an alpha would have the rows scrolling underneath it
  show through.
- **The chosen team is remembered; the group filter deliberately is not.**
  `lib/remembered.ts` keeps the team's identifier — never a name, never a
  colleague, never a figure, all of which `persist: false` forbids — so a return
  visit does not begin by picking your own team out of a list. An opaque
  identifier this app minted names nobody. A team has no safe default, so
  remembering it saves a choice the reader has to make anyway.
  The filter is the opposite case, and that is why it is treated the opposite
  way. Its default is the widest and most honest state — every hour GitLab will
  show this reader for those people — and remembering a narrowing would make
  every later visit show less than the scope sentence prepares the reader for,
  silently, in the one direction that understates a colleague's month.
  An address that names a team is never overridden, because a link somebody sent
  outranks this reader's habit; one that names none is completed by
  **redirecting** rather than by filling the screen in behind it, so what you are
  looking at stays what you can send somebody else.
  (Two group pickers on one screen was built and reverted once — a wider group to
  read and a narrower one to draw — and that reversal is the argument _for_ the
  pair that shipped, not against it. Those two asked overlapping questions in the
  same vocabulary, and each one's right value depended on the other's, so neither
  had a default. These two do not overlap: one names **people**, the other names
  **how much of their work counts**, and exactly one of them has a correct
  default — "all of it", which the screen says out loud. That is the property the
  reverted pair lacked.)
- **The filter travels in the address as a path, and a group the reader cannot
  open drops the narrowing rather than the report.** A path because an address is
  meant to be read and sent, and `full/path/to/group` says what it means where
  `gid://gitlab/Group/1234` does not; it is resolved once to the `GroupID` the
  provider's own argument takes, so the identifier never reaches a link. Nothing
  in `teamSearchFrom` throws — an address may have been typed or sent by somebody
  else, so a month that is not a month becomes the month containing today rather
  than a blank screen with a stack trace behind it. And when the named group
  cannot be opened, the figures are shown unscoped with a notice saying the scope
  was dropped. It is not one of the states in `lib/state.ts` for that reason: an
  unreadable scope and an empty scoped report are different facts, and the reader
  came for the hours.
- **The key lists only the marks the table uses.** A legend entry for something
  that is nowhere on screen sends the reader hunting for it, and finding nothing
  is indistinguishable from having missed it. Read off the grid in
  `pages/team-hours/lib/legend.ts`. The reference bar is always listed: it
  explains every figure there is.
- **What an empty cell may claim follows the filter, and there are two strings
  for it.** Unnarrowed, the cell says "No hours logged anywhere." — the strongest
  claim this screen has ever made, and it is now sayable: `users(ids:)` with a
  `User`-parented `timelogs` reaches every hour GitLab will show this reader for
  that person, personal projects included, so nothing was left unasked. Narrowed
  to a group, it says "No hours in this group." — the original prohibition,
  verbatim, for the original reason: a group's connection is scoped by
  `Timelog.in_group` to that group and its descendants, so an hour logged on an
  issue elsewhere is not missing from the answer, it was never asked for. The
  cells used to read "No time logged" in both cases, which is a claim about a
  person made from a measurement of a group, and a reader who reaches the table
  by landmark never passes the subtitle that qualified it.
  Two keys — `team_cell_unlogged_anywhere` and `team_cell_unlogged_in_group` —
  not one with the group as a parameter: unnarrowed there is no group to
  substitute, and an empty parameter renders a sentence with a hole in it. The
  table caption carries the scope either way, so it is announced where the
  figures are rather than in a subtitle above them.
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
  first round already answered for free — it carries a `count` beside the nodes,
  so a row whose count matches what arrived proves with no second request that
  nothing was removed from it. A team where the reader can open everything costs
  no extra request at all. One request per short row, capped at six.
  A whole grid is not askable: each alias costs 7 of GitLab’s 250-point
  complexity budget, so a month of columns plus the period check scores 229 and
  fits, while forty columns score 292 and are refused. A team's grid is columns
  times people and is refused long before it reaches a database.
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
- **The team report is never written to the device, and neither is the team.**
  Every query in the slice carries `meta: { persist: false }` — from
  `NOT_PERSISTED` in `api/query-shape.ts`, one constant rather than a copy per
  file, because it is a rule and a second copy is a second place to forget it —
  and `__root.tsx` reads that rather than a key it has to recognise. The reader's
  own hours are persisted because that is what paints a return visit before any
  request. These belong to other people, and a shared machine must not keep them.
  That covers the roster as much as the figures: a team is a list of colleagues'
  names, and writing one to IndexedDB is the same leak by a quieter route. The
  one thing kept across visits is the chosen team's identifier, which this app
  minted and which names nobody.
- **There is a backend now, and it is two functions over one handler on this
  origin.** `netlify/functions/{teams,preferences}.mts` over Netlify Blobs. Same origin is the whole
  reason the store is Netlify's rather than a database elsewhere: the app's
  `connect-src 'self'` already reaches it, so there is no CSP change, no CORS
  preflight and no allow-list to keep right. It authenticates from the
  `Authorization` header and from nothing else — no cookie, no session, no
  `Origin` check — and emits no CORS headers at all, which is what makes it
  CSRF-exempt rather than CSRF-lucky: a cross-site form cannot set that header,
  and a cross-site `fetch` that does triggers a preflight this will not answer.
  Adding a cookie credential or a permissive CORS header would quietly undo that.
  Identity is a GitLab OIDC `id_token`, verified offline against JWKS with
  `jose`: `RS256` named rather than inferred, because letting the token choose
  the algorithm is how algorithm confusion gets in; discovery refused unless the
  key endpoint is on the provider's own origin; and `maxTokenAge` bounding replay
  independently of whatever `exp` claims. The token is minted on demand through
  the same single renewal a burst of requests already shares, and never written
  to storage. The only thing that leaves the verifier is a subject — the `openid`
  scope also puts `email` and `groups_direct` in that token, and the `Identity`
  return type is what keeps them from reaching anything else.
- **The storage key is derived from the verified subject, so IDOR is not
  expressible.** `v1/${sub}/teams` and `v1/${sub}/preferences`, in a store named
  `readers` — production's; every other deploy's is `readers-staging`, below —
  where `sub` comes from the signature and from nothing the request
  carried — no path parameter, no body field, no header. The
  difference from checking an id against the caller is that there is no check to
  forget: naming another reader's teams is not a request this endpoint can
  refuse, because it is not a request it can represent. A write carries the
  version it was made against, in `x-document-version` — the etag, or `*` for a
  first write — and one carrying neither is refused **428** rather than
  accepted, because a `PUT` with no precondition is a client that never read,
  and the silent clobber is the failure mode a last-write-wins store has.
  **The store names the partition and every document names itself**, and both
  halves of that are corrections. The store was `teams`, which stopped being
  true the day the reader's settings moved in beside them; it is `readers` now,
  because the top level of every key is one reader and a name describing the
  partition cannot go stale when a third document arrives. Not `users` or
  `accounts`: those claim the store holds an identity, and it holds a subject
  and nothing else, which is what `Identity` exists to enforce — the documents
  themselves hold a great deal, and README.md says so. And the teams document's
  suffix was empty: it was the first thing stored and took the reader's key
  unqualified, which left the teams key a _prefix_ of the preferences key. A
  `list({ prefix })` over `v1/${sub}` would have returned both and read one
  reader's teams as a folder holding their settings, and a subject of
  `X/preferences` would have composed to exactly the key subject `X` files
  theirs under. Neither could happen — `DocumentStore` offers only `read` and
  `write`, and `USABLE_SUBJECT` refuses `/` — but both were refused by a regex
  and an absent feature rather than by the shape, and both of those are things
  somebody widens. With every document named there is no subject and no suffix
  that compose to another pair's key at all.
  **Changing any of this moves nothing.** A deploy simply starts reading a key
  that is not there, and a missing key is indistinguishable from a reader who
  has never saved — no error, no null anybody sees, just an empty screen where
  a roster was. It is the same hazard as the region, and it was taken here
  deliberately: the store is being emptied rather than migrated, because nobody
  had stored anything worth keeping yet. A later change does not have that
  option, and `docs/qa/release-checklist.md` carries it under rollback.
  `handle-document.test.mts` pins the key each document lands on and the
  no-key-inside-another invariant over the set, because the whole of this used
  to be asserted in prose: setting the suffix back to `''` passed the entire
  suite, including the test next door that proves the two documents do not
  overwrite each other — `v1/1` and `v1/1/preferences` are distinct keys too,
  so equality was never the property at risk.
  **It is not `If-Match` and `If-None-Match`, which is what it was and where
  the semantics come from.** Those never reached the function on a deployed
  site: Netlify's CDN uses the `If-*` headers for its own conditional requests
  and consumes them on the way through, so every write was refused 428 —
  correctly, and uselessly. Nothing could see it, because the three places that
  exercise a write have no CDN in them: the `functions` project calls the
  handler directly, the acceptance suite route-stubs the endpoint, and
  `bun run dev` is a Vite middleware. The header is declared on both sides,
  since `netlify/` must not import from `src/` at run time, and
  `handle-document.test.mts` holds the two spellings against each other. The
  instrument that can see the path itself is a deploy, and
  `docs/qa/release-checklist.md` now reads the request rather than the result.
  **And it is not `ETag` on the way back, for the same kind of reason.** The
  version returned as `ETag`, which the CDN rewrites when it compresses a
  response: `"8c97…208"` reached the browser as `"8c97…208-df"`, the reader
  handed that back, and it named nothing stored — so every save after a
  reader's first was refused as "changed somewhere else", and settings stopped
  syncing without a word. It survived a release checklist that read the `PUT`,
  because every first write goes out as `*`: only a second save takes this
  path, and the first second save anybody made was in production. The answer
  carries `x-document-version` now and no `ETag` at all, so there is no
  corrupted copy for a client to read, and the checklist saves twice. A header
  HTTP defines is a header the path between here and the browser acts on;
  every header this protocol needs is one of its own. `DocumentStore` is a port for
  the same reason: those rules are the part worth testing, and the acceptance
  suite serves a static `dist/` with `vite preview`, which runs no function — so
  the `functions` Vitest project is the only place they are proved.
- **The store follows the deploy, and a deploy that cannot say which it is gets
  none.** `netlify/lib/store-name.mts` (DELIVERY-1): `production` files readers'
  documents under `readers`; `branch-deploy`, `deploy-preview` and `dev` under
  `readers-staging`; anything else answers `503 store-unavailable` before a key
  is fetched or a store is asked. Homologation is where something broken is tried
  on purpose, and a roster is a list of colleagues, so the two must not be able
  to reach each other's documents — before this, every preview wrote to
  production's store.
  The context comes from the function's second argument,
  `context.deploy.context`, because there is nothing else at run time: `CONTEXT`
  is a build-time variable, and a function is given only `URL`, `SITE_NAME` and
  `SITE_ID`. A per-context variable set in the Netlify UI was the alternative,
  and it is a second place the rule lives, silent when missing.
  **Refusing is the point, not a gap.** Defaulting to production lets a misread
  homologation deploy write over readers' documents in silence; defaulting to
  homologation shows every reader in production an empty list of teams they did
  make. A refusal is loud both ways, and the release checklist reads
  production's teams straight after a deploy, which is where a value the
  platform changed would show.
  `readers` keeps its name for the reason the key paragraph above gives:
  changing it moves nothing. And a bundle from before this names `readers` on
  every deploy, so reverting it onto `staging` is homologation writing to
  production — `docs/qa/release-checklist.md` says to turn staging's branch
  deploys off first.
- **The OAuth scope is `read_api openid`, and the deployment order is
  load-bearing.** Tick `openid` on the GitLab OAuth application **before**
  deploying the bundle that asks for it; the other order fails every sign-in with
  `invalid_scope`, for everyone, including readers who never open the team
  screen. `openid` confers no authority over data — it is what lets the endpoint
  above learn who is calling without this app vouching for the claim itself. A
  session granted before the scope changed keeps working and is not signed out:
  it authorises everything else it always did, so the reader sees an inline
  reconnect notice on the teams surface and the quiet unsynced line on
  `/settings`, and authorising once more repairs both. Both surfaces degrade to
  what the device itself holds, which is what they showed before any of this
  existed. Signing them out would lose their place for no gain, and saying
  "unavailable" would send them looking for an outage.
- **Two of the four settings follow the reader; two stay on the device.** The
  daily target and the time zone are facts about the _person_ — they decide what
  a full day is and which calendar day an entry lands on — so they are kept in
  the reader's own store beside their teams, under `v1/${sub}/preferences`. The
  colour scheme and the language are facts about the _machine_, and the theme is
  applied by an inline script **before the first paint**, which a value fetched
  over the network cannot be.
  That distinction stopped being cosmetic when the team table began measuring its
  bars against the daily target: the same month drew different bars on two
  laptops belonging to one person, and a report whose shape depends on which
  machine is open is a report nobody can quote.
  **The device is still the read path.** `useStoredValue` reads `localStorage`
  synchronously on the first render, so no screen gained a skeleton and no query
  was introduced. The store is a second opinion that arrives afterwards and can
  only ever replace what is on screen with something the same reader wrote more
  recently somewhere else.
  **Reconciliation is last write wins on a recorded instant, and that is
  deliberately not how a team is reconciled.** A roster is edited by somebody
  watching it, so a stale write there is refused and reported — losing a
  colleague silently is the worst thing that surface can do. Settings change in
  the background, one field at a time, from a form nobody is waiting on for a
  verdict; what a race costs is one number the reader can see and set again, and
  a dialog about it would be a dialog over nothing.
  The endpoint's discipline is **not** weakened to get that. It still refuses a
  write naming the wrong version and still refuses one naming none. Last-write-
  wins is a _client policy_ in one bounded retry, in
  `api/preferences-gateway.ts`: on a conflict, compare the instants; theirs is
  newer, adopt it; ours is newer, write once more against the version we were
  just handed; a second conflict is read rather than retried, which terminates
  and gives the same answer.
  `updatedAt` lives on the envelope, never on `Preferences`. No screen reading a
  target has any business with when it was set, and the instant is stamped in the
  provider because the model may not reach for a clock. A document with no
  readable instant carries **null**, and a device holding one does not compete:
  it adopts whatever the store has, and pushes only against a store that holds
  nothing at all. Both halves are load-bearing and they are not symmetric.
  Adopting is what stops a fresh install — defaults, nothing recorded — from
  pushing those defaults over settings the reader really set on another machine.
  Pushing against an empty store is what carries settings a device was already
  holding before any of this existed, without waiting for the reader to touch a
  field. That push is **stamped on its way out, and an undated document is never
  sent at all** — the endpoint refuses one, because nothing could order it
  against another device's, so sending it would report a failure to a reader who
  had just arrived and set nothing. It shipped that way for an afternoon and no
  gate saw it: the gateway test asserts what goes out, the handler test asserts
  what a well-formed request gets back, and neither is where the two shapes meet.
  `netlify/lib/preferences-contract.test.mts` is that place now.
  It was an epoch date first, exactly as an unreadable team is, and that
  said "1970" about a document nobody dated: two devices that had both never
  recorded an instant then agreed with each other while holding different
  settings, so neither adopted and the two drifted apart in silence. A reader can
  still lose a setting they can see, but only to an instant — the other device
  wrote later, which is the whole rule.
  A store that will not answer costs nothing but the syncing. The values the
  reader set are in effect — written to the device before anything was sent —
  and `/settings` says in one quiet line that they are not being carried. It is
  said there and nowhere else: a setting that silently stops following somebody
  is found out months later, on the wrong figure.
- **One handler serves both documents, and one endpoint body serves both
  functions.** `handle-document.mts` is parameterised by the key suffix it
  appends, the document it parses and the size it accepts;
  `document-endpoint.mts` is everything in front of it — the configuration read,
  the key discovery and its cache, the 503 that says only that identity could
  not be established — so `netlify/functions/{teams,preferences}.mts` are three
  lines each, naming a document and a path. They were fifty lines each and
  identical, and the copy held the least obvious rule of the three: a **failed**
  discovery must not be cached, or one bad minute outlasts itself for the whole
  life of the instance. `config/vite/api-dev.ts` was a third copy, and a worse
  one — it discovered on every request. It runs the same body now, with the
  memory store passed in, so what is left in it is the translation between what
  Vite hands a middleware and what a function is called with. The security
  property is unchanged and worth restating, because a refactor is where it could
  quietly be lost: **the suffix is a constant a function module chooses, never a
  value read from the request.** `v1/${sub}/teams` and `v1/${sub}/preferences`
  are both derived from a subject the signature established and from nothing a
  caller sent, so addressing another reader's anything stays inexpressible rather
  than refused. Duplicating sixty lines of credential handling into a second module
  was the alternative and is worse: two copies are two places to fix a rule, and
  the second is the one somebody forgets. `config/vite/api-dev.ts` serves both
  under one store for the same reason the deployed ones share one — a suffix that
  was not distinct would have the two documents overwriting each other, and each
  would look perfectly well-formed on its own.
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
  what the CLI generates — with four exceptions, all marked in place:
  `button.tsx` and `input.tsx` carry measured contrast fixes to the invalid
  border, the outline edge, and the solid and quiet hover states, and
  `dialog.tsx` and `select.tsx` carry corrections to what the generator wrote.
  Regenerating any of them means re-applying those. Three of button's four are
  held by `bun run a11y:contrast`, so undoing them fails `verify` rather than
  shipping. Anything that opens a list also reads `popup.ts`.
  **The CLI rewrites files it was not asked for, and installs a package that is
  not real.** `shadcn add dialog` overwrote `button.tsx`, dropping every fix
  above; both it and `shadcn add select` wrote `import { cn } from "cn"` and
  installed an unrelated npm package of that name, because the alias in
  `components.json` does not resolve. Read `git diff` after every add: the
  contrast gate catches the first of those and nothing catches the second.
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
matrix, the screen-reader procedure and the release checklist.

## Planning

Changes are planned with OpenSpec (`openspec/`) before they are implemented:
proposal → specs → design → tasks. Use the OpenSpec CLI, not hand-edited files.

Never create issues or epics in any tracker without being asked.
