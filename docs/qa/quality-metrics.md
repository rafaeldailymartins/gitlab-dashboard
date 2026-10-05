# Quality metrics

Every metric below has a target, a command that measures it, and a place that
enforces it. A metric nobody enforces is a wish, not a metric.

The "measured" column records what the command printed, so a drift is visible
without running anything. Every figure in it was taken on **2026-09-23**, on
`feat/report-a-teams-hours`, after the settings sync landed — one pass with every
gate green, which is the state a branch should be read in. Where a figure is
volatile the sentence beside it says which command answers it. A sentence
reporting an older measurement carries its own date; one with no date belongs to
this pass.

## Enforced gates

| Metric                               | Target                                       | Measured                       | Command                         | Enforced at                   |
| ------------------------------------ | -------------------------------------------- | ------------------------------ | ------------------------------- | ----------------------------- |
| Formatting                           | no deviation                                 | pass                           | `bun run format:check`          | pre-commit, `verify`, CI      |
| Lint (type-aware)                    | 0 errors, 0 warnings                         | pass                           | `bun run lint`                  | pre-commit, `verify`, CI      |
| Lint (ARIA and element ids)          | 0 errors                                     | pass, 121 files                | `bun run lint:a11y`             | `verify`, CI                  |
| Colour contrast                      | every pair above its floor, in both schemes  | pass, 96 pairs                 | `bun run a11y:contrast`         | `verify`, CI                  |
| TypeScript                           | 0 errors under full strictness               | pass                           | `bun run typecheck`             | pre-push, `verify`, CI        |
| FSD conventions                      | 0 problems                                   | pass                           | `bun run arch:layers`           | pre-push, `verify`, CI        |
| Dependency graph (cycles, orphans)   | 0 violations                                 | pass, 250 modules, 849 edges   | `bun run arch:graph`            | pre-push, `verify`, CI        |
| Dead code (files, exports, deps)     | 0 findings                                   | pass                           | `bun run deadcode`              | pre-push, `verify`, CI        |
| Translations                         | every key in every language, and none unused | 176 messages, complete in 2    | `bun run i18n:check`            | `verify`, CI                  |
| Requirement traceability             | every requirement cited                      | 80 declared: 71 cited, 9 other | `bun run arch:trace`            | `verify`, CI                  |
| Type coverage                        | ≥ 99%                                        | 99.88% (51 911 of 51 969)      | `bun run types:coverage`        | `verify`, CI                  |
| Production vulnerabilities           | **0, at any severity, no exceptions**        | 0, over 92 packages            | `bun run security:audit`        | pre-push, `verify`, CI, daily |
| Tooling vulnerabilities              | 0 not accounted for in `accepted.ts`         | 1 accepted, over 887 packages  | `bun run security:audit`        | pre-push, `verify`, CI, daily |
| New vulnerable packages              | none added, at any severity                  | —                              | dependency review               | CI, pull requests             |
| Commit messages                      | Conventional Commits, every commit           | —                              | `bun commitlint`                | commit-msg, CI                |
| Test coverage, statements            | ≥ 90%                                        | 97.36%                         | `bun run test:coverage`         | CI                            |
| Test coverage, branches              | ≥ 90%                                        | 93.64%                         | `bun run test:coverage`         | CI                            |
| Test coverage, functions             | ≥ 90%                                        | 96.53%                         | `bun run test:coverage`         | CI                            |
| Test coverage, lines                 | ≥ 90%                                        | 97.43%                         | `bun run test:coverage`         | CI                            |
| Test coverage, `model/`              | **100%**                                     | 100%                           | `bun run test:coverage`         | CI                            |
| Mutation score, `model/`             | ≥ 85%                                        | 93.46%, 66 of 1039 survived    | `bun run test:mutation`         | scheduled CI                  |
| Initial bundle                       | ≤ 180 kB gzip                                | 178.17 kB, on 2026-10-01       | `bun run build && bun run size` | CI                            |
| Fault reports carry nothing personal | no planted value survives, in any field      | pass                           | `bun run test`                  | CI                            |
| Browser and function scrubs agree    | one answer for every generated report        | pass                           | `bun run test`                  | CI                            |
| No source map served                 | no `.map` in `dist/`, no chunk naming one    | pass, 41 removed               | `bun run build`                 | CI                            |
| Accessibility (WCAG 2.1 AA)          | 0 axe violations, light and dark             | pass, 16 audits, chromium      | `bun run test:e2e`              | CI                            |
| Cumulative layout shift              | < 0.1, cold and warm                         | pass, both, chromium           | `bun run test:e2e`              | CI                            |
| No sideways scrolling at 375 px      | every screen                                 | pass, 7 screens, chromium      | `bun run test:e2e`              | CI                            |

The last three rows are read off one local run, chromium alone over the 111
scenarios `bddgen` expanded on this pass; the matrix is CI's job.

**The bundle row and the three fault-reporting rows are from 2026-10-01**, when
`observe-faults-in-production` landed. The bundle is measured without a DSN, as
CI builds it. With one, as production builds it, it read 178.27 kB: the
reporting chunk, 21.4 kB, is fetched when the page is idle and is outside both
figures. `@sentry/vite-plugin` read 181.43 kB on the same bundle, and is why
source maps are uploaded by `sentry-cli` instead. The privacy row is
`src/shared/lib/scrub.properties.test.ts`, which plants generated names,
emails, team names, group paths, tokens and query strings in every field of a
report and finds none afterwards. Like coverage, it is a property, not a list
of cases, so a field Sentry adds next year is held to it without anybody
writing a test. `netlify/lib/scrub-contract.test.mts` holds the functions'
copy of the rule to the browser's, and `scripts/drop-source-maps.ts` fails the
build rather than letting a map be published.

**The traceability row is two numbers, not one.** `bun run arch:trace` prints
`80 requirements, 71 cited by scenarios, 9 covered another way`, and the
difference between those last two is the part worth reading. The nine are listed
in the script's `UNCITED_BY_DESIGN` map with the reason a browser cannot observe
them, each naming the test that can: `AUTH-10` counts token exchanges, which no
screen shows, and `TEAM-3` is the rule that a reader cannot address another
reader's storage key — a browser can neither forge a credential nor reach the
deployed function, so `netlify/lib/handle-document.test.mts` and
`netlify/lib/identity.test.mts` carry it instead. A single "80/80" hides that
nine requirements rest on a map an author can add to. The gate fails in both
directions, including on an entry naming a requirement that no longer exists, so
the map cannot quietly outlive what it excuses.

**Two gates were red while this branch was being written, and this table used to
say so.** Both are green on this pass. What is worth keeping is not the numbers —
five lint errors and one type error, none of which survived the hour — but their
shape: every one of them was in a file that had not existed when the previous
reading was taken. That is the honest reason this document dates a whole pass
rather than each row, and the reason `verify` is the thing that has to be green
rather than a table anybody can update by hand.

## Test projects

`vitest.config.ts` defines three, and `bun run test` runs all of them: 1675 tests
across 119 files on this pass. Every count in this section moves with every test
written, and on this branch that has been several times an hour —
`bun run test` prints the totals, and the split below is `--project=<name>`
three times.

| Project     | Environment | What it runs                                                                                                                              | Files | Tests |
| ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----: | ----: |
| `domain`    | node        | `src/**/model/**`, `shared/lib/{duration,people}.ts`, and `tests/domain/` Gherkin                                                         |    36 |   751 |
| `ui`        | happy-dom   | components and hooks against a DOM, with GitLab's API mocked by MSW                                                                       |    73 |   793 |
| `functions` | node        | `netlify/**/*.test.mts` — both document endpoints, the handler they share, its identity verifier, the fault-reporting tunnel and reporter |    10 |   131 |

**`functions` is not a third place to put tests; it is the only place the
endpoint's rules can be proved.** The acceptance suite serves a static `dist/`
through `vite preview`, which runs no Netlify function, so it route-stubs
`/.netlify/functions/{teams,preferences}` — and a stub cannot prove a rule it is itself
implementing. The blob store and the identity verifier are ports, so this project
injects an in-memory store and a locally minted key pair instead of reaching for
a platform: `getStore` outside a Netlify environment throws
`MissingBlobsEnvironmentError` before it hands back anything to test against.

`{teams,preferences}-contract.test.mts` are the odd files in that project and the
reason it resolves the `@` alias the other two use: they import the browser's
lenient codec and run it beside the endpoint's strict validator, which is the
only place the two halves of one stored shape are held against each other. They
sit in different layers and different runtimes, so nothing else makes them meet.
The settings pair earned its own file after a review, and earned it the hard way:
the browser was sending a document carrying no instant, which the endpoint
refuses — and every level either side of this one was green, because a gateway
test asserts what goes out and a handler test asserts what a well-formed request
gets back, and neither of them is where the two shapes meet.

Above those, `bddgen` expands `features/acceptance/*.feature` into one Playwright
spec per scenario, and `bun --bun bddgen && playwright test --list` is what
counts them. On this pass that was 111 locally, which is chromium alone; CI runs
three browsers — chromium, webkit and a Pixel 7 viewport — for 333.

## Two linters, on purpose

ESLint carries the rules that need type information and the ones that need to
understand React or the test libraries. Biome carries the ARIA rules and the
unique-id rule, and nothing else.

Replacing ESLint outright was measured on **2026-08-22** against Biome 2.5.10 —
still the pinned version — twice, and the first attempt was wrong in a way worth
recording, because the mistake is easy to repeat. Running
`biome lint --config-path <elsewhere> src` reports nothing from the type-aware
rules: the project scanner anchors on the directory holding the config, so with
the config outside the project it has no project to scan and the rules silently
find nothing. From the repository root they work.

With that corrected, a file written to contain one instance of each rule this
project relies on gave: ESLint 8 findings, Biome 4.

| ESLint rule                          | Biome                                    |
| ------------------------------------ | ---------------------------------------- |
| `no-floating-promises`               | `noFloatingPromises` — nursery, opt-in   |
| `no-unnecessary-condition`           | `noUnnecessaryConditions`                |
| `require-await`                      | `useAwait`                               |
| `restrict-template-expressions`      | none                                     |
| `no-base-to-string`                  | none                                     |
| `unbound-method`                     | none                                     |
| `perfectionist/sort-modules`         | `useExportsLast`, which is a weaker rule |
| `sonarjs/different-types-comparison` | none                                     |

Biome does cover more than a first look suggests: every complexity ceiling here
has an equivalent (`useMaxParams`, `noExcessiveLinesPerFunction`,
`noExcessiveLinesPerFile`, `noExcessiveNestedCallbacks`,
`noExcessiveCognitiveComplexity`), as do the restricted imports and globals that
keep `model/` pure (`noRestrictedImports`, `noRestrictedGlobals`,
`noNodejsModules`), the import-cycle check, and Tailwind class sorting.

What has no equivalent at all is the part that has been catching defects:

- **`testing-library/*` — nothing.** Biome has no rule from that plugin, and
  half the tests here run against a DOM — 793 of 1675. `no-node-access` is what
  stopped a test from walking the DOM, which is how the ARIA bug below came to
  light.
- **`react-hooks/set-state-in-effect` — nothing.** Biome ships four rules from
  `eslint-plugin-react-hooks`; that is not one of them. It caught a real bug in
  the OAuth callback.
- The four type-aware rules in the table above.

And `noFloatingPromises` sits in the nursery group, which Biome documents as not
subject to semantic versioning.

The speed argument, **measured on 2026-08-22 and not since**: ESLint 33 s cold
and **3.9 s warm with `--cache`**; Biome 2 s with the project scan, 300 ms
without. Cold CI runs were 33 s against 2 s. Both the source and the suite have
grown a long way since — a cold `bun run lint` over this branch took 51 s on
2026-09-18, and `bun run lint:a11y` 230 ms over 114 files — so treat the 2026-08-22 pair as the
shape of the trade rather than as current timings. A timing taken on a machine
that is doing anything else says more about the machine than about either tool,
which is why these are not refreshed in place. What has not moved is the shape:
half a minute of CI against three rules that have each found a real defect in
this repository.

Biome earns its place for what it alone catches. It found an `aria-label` on a
generic element in four files — prohibited ARIA, so every screen reader ignored
it — which `jsx-a11y` and the axe assertions both let through. It also found two
hardcoded `id` attributes behind `aria-labelledby`, which work only while each
section renders once. Two of its recommended ARIA rules are off:
`useSemanticElements` asks for a `<fieldset>` wherever it sees `role="group"`,
and `noLabelWithoutControl` cannot see through the shadcn `Label` wrapper.
`biome.json` is strict JSON and can carry no comment beside either line, so this
paragraph is the only place those two reasons are written down — which is the
one exception to the rule in AGENTS.md that an ignore entry is explained where it
sits.

## Complexity ceilings

Enforced per function and per file by `config/eslint/limits.js`.

| Limit                          | Value                                            |
| ------------------------------ | ------------------------------------------------ |
| Cyclomatic complexity          | 8                                                |
| Cognitive complexity (sonarjs) | 10                                               |
| Lines per function             | 40 (60 for components, since JSX is declarative) |
| Lines per file                 | 200                                              |
| Parameters                     | 3                                                |
| Nesting depth                  | 3                                                |
| Nested callbacks               | 3                                                |
| Statements per function        | 15                                               |

## What coverage deliberately does not measure

`vitest.config.ts` scopes coverage to authored logic by naming what is included:
`entities`, `features`, `widgets`, `pages`, `shared/lib`, `shared/i18n`, the
components we author in `shared/ui`, and `netlify/**/*.mts`. Everything else is
out, and what is left out is left out for a reason:

- `src/shared/ui/{button,card,collapsible,input,label,skeleton}.tsx` — the only
  named exclusion, because these six are generated by the shadcn CLI and covering them would
  measure someone else's code. The list is explicit rather than a directory glob,
  so a component we write in `shared/ui` is still measured; `select-field.tsx`
  is.
- `src/app/**` — router and provider wiring, left out of the include list and
  exercised end to end by the Playwright acceptance suite instead.
- `src/paraglide/**` and `src/app/routeTree.gen.ts` — generated output, likewise
  out by omission.

**The serverless functions are measured too**, at the global floor rather than the
hundred-percent one — the include list names `netlify/**/*.mts`. The rules that
hold the feature's security are pure decisions over a request and a document,
and `handle-document.mts` sits at 98.3% of statements, with
`document-endpoint.mts` beside it. What surrounds them is I/O
wiring, which the floor is the right instrument for: a `model/` threshold there
would be satisfied by tests that assert a platform behaves the way the mock was
written to.

Two files in it read 0%, and honestly so:

- `netlify/lib/blob-store.mts` is unreachable by any test that does not bring a
  platform with it. Calling `getStore` outside a Netlify environment throws
  `MissingBlobsEnvironmentError` — verified by calling it — so the only test that
  could execute this file is one that stubs `@netlify/blobs`, which would assert
  that the stub does what the stub was written to do. It is a port implementation
  and the port is what the handler is tested against.
- `netlify/functions/{teams,preferences}.mts` are three lines each: a document, a
  path, and `documentEndpoint`. Everything they used to do themselves — reading
  the environment, discovering the provider's keys, answering 503 when identity
  cannot be established — moved into `netlify/lib/document-endpoint.mts` when
  the second one made it a copy, and `document-endpoint.test.mts` covers it
  there. What is left in these two is a constant and an export, which is the
  right amount of untested.

  That move is also the clearest thing in this document about what a coverage
  percentage is worth. It was made because fifty lines were duplicated, not to
  raise a number, and the number moved 1.5 points on its own: statements went
  from 95.29% to 96.75% without a single new assertion about behaviour that was
  not already being made somewhere. A figure that swings that far on where code
  is filed is a floor, which is what this section says it is.

Both are covered by the deploy check in `release-checklist.md` instead, which is
the only place a real store and a real token exist together.

A line that is hard to cover is a design signal. Moving code out of a covered
path to make a number go up is not an acceptable fix.

## Coverage is a floor, not a target

The thresholds are 90% overall and 100% on `model/`. Measured coverage sits at
97.36% of statements and 93.64% of branches, and that gap is worth naming:
nothing forced it, and chasing it is not free.

100% on `model/` is right. That layer is pure functions with no I/O, and it is
where a wrong hour figure comes from. A hard-to-cover line there is a design
signal, not an excuse. What the floor cannot tell you is whether the tests that
reach those lines assert anything, which is the whole reason mutation testing
runs over the same files — `entities/teams/model/team.ts` is at 100% of lines
and 77.78% of mutants, and the gap is entirely in the guards that decide whether
a stored team is readable.

Outside `model/`, the last few branches are not chased. A branch is worth a test
when a reader would notice it being wrong — a period with no target, a day split
across two pages, a refused credential. A branch is not worth a test when the
only way to reach it is to defeat the type system, and a test written to reach it
asserts nothing a reader cares about. Two such tests were written during an
earlier change and removed again: they asserted that a number was printed, in
order to reach a `??` fallback that the surrounding arithmetic makes unreachable.

**Coverage measures that a line ran, not that it worked.** The clearest proof of
that in this repository: four screens gave their hour figures an `aria-label` on
a `<span>`. Naming is prohibited on a generic element, so every screen reader
ignored it and read "6.7 h" as digits and a letter. Those lines were covered,
and the tests asserted `getByLabelText('6.7 hours')` and passed — Testing
Library computes an accessible name whether or not the platform would. Coverage,
`jsx-a11y` and the axe assertions in the acceptance suite all missed it; Biome's
`useAriaPropsSupportedByRole` found it. The figure now renders the spoken form as
visually hidden text, which works in any role, and the tests assert on that text.
That is why the quality signals here are mutation testing, axe and the a11y
linter — with coverage as the floor that stops whole paths going unexercised.

## Known measurement caveats

- **The mutation score is 93.46%, and where it is spent matters more than the
  number.** 1039 mutants over 25 files: 969 killed, 66 survived, 2 timed out, 2
  with no covering test. Those figures are read off
  `reports/mutation/report.json` rather than from a fresh run — Stryker takes
  tens of minutes, which is why it is on a schedule and not on the blocking
  path. The report is only worth reading while nothing it measured has moved
  under it, so the check before quoting it is
  `find src -newer reports/mutation/report.json -name "*.ts"`. It has to come
  back with nothing but `src/paraglide/`, which every gate rewrites; a `model/`
  file in that list means the score above is about code that no longer exists.
  Nothing else was in it when these figures were taken. Thirty-four of the 66 are
  in one file,
  `entities/teams/model/team.ts` at 77.78% — the decoder that reads a stored team
  back, and the one part of this feature reading data another version of this app
  wrote. Its guards are what survive. The `null` check —
  `typeof source !== 'object' || source === null` — survives having its operator
  flipped, because a member that is literally `null` is the only input that tells
  the two apart and no test supplies one; and
  `!nonEmpty(id) || !nonEmpty(name) || !nonEmpty(username) || !USERNAME.test(username)`
  survives being regrouped, because the tests reject a malformed member without
  asserting which clause rejected it. The two mutants with no covering test are
  both in `entities/teams/model/ports.ts`: nothing constructs a `TeamsError`.
- **The total is stable between runs; the per-file split is not, and this
  document used to imply otherwise.** Two runs over identical code, minutes
  apart, printed 93.65% and 93.46% — and moved four survivors between
  `preferences/model/daily-target.ts` and `preferences/model/preferences.ts`
  while doing it. `coverageAnalysis: "perTest"` decides which tests each mutant
  is run against, and that attribution is not stable under parallel workers, so
  the same mutant can face fewer tests in one run than in another. What follows
  for reading this section: the total is worth quoting to a tenth, a per-file
  percentage is not, and the survivors worth acting on are the ones that appear
  in every run. The ones named below do.
- **Not every survivor is a gap, and the equivalent ones must not be "fixed".**
  A narrowing guard TypeScript requires but that carries no behaviour produces a
  mutant nothing can kill. Both are still in the list and both are still
  equivalent: `typeof parsed === 'object' && parsed !== null` before the spread
  in `decodePreferences`, whose own comment records that spreading a non-object
  yields no key and every field falls back anyway, and the same narrowing written
  as a rejection in `dailyTargetFrom`. Removing either would mean weakening the
  types. A third joined them with the settings sync: `here > there` in
  `preferences/model/reconcile.ts` survives becoming `>=`, because the equal
  case answered `agree` and returned two lines earlier, so no input reaches that
  comparison with the two instants equal. Every other survivor in that slice is
  one of the two narrowings above. What is not equivalent is an `||` flipped
  between distinct rejections, or `index < binary.length` becoming `<=` in
  `id-token.ts` with nothing noticing. The survivors have not been triaged since the team work landed;
  `reports/mutation/index.html` lists every one with its location.
- **Type coverage is 99.88%, and the shortfall is listed by name.**
  `bun run types:coverage` prints every expression it cannot type — 59 of 47 703
  on 2026-09-18, 58 of 51 969 on this pass — so read its output rather than a count written down here.
  Twenty of the 59 are in shipped code, 35 in tests and test support, and four in
  tooling that ships nothing (`.size-limit.js`, `scripts/`, `config/`). Of the
  twenty, eight are assertions, and they are the ones worth knowing: branding a
  validated `IsoDate`, narrowing a native select's value to the union it was
  rendered from, and six widenings of a value proved only to be an object, so
  that a field can be read off it or it can be spread — the two team decoders,
  the OAuth pending-authorization guard, the provider-metadata reader in
  `netlify/lib/identity.mts` twice, and the conflict body in
  `netlify/lib/handle-document.mts`. A further three shipped assertions cost
  nothing and so never appear in that list at all: `as unknown` at a
  `JSON.parse` or `response.json()` boundary, in `gitlab-oauth.ts`,
  `id-token.ts` and `shared/api/graphql.ts`, because `unknown` is a real type.
  The remaining twelve untyped expressions in shipped code are not assertions but
  values the compiler reads as `any` from somebody else's types — TanStack
  Table's sort functions in `top-items-table.tsx`, the router in
  `auth.callback.tsx`, a caught `error`, and four bindings in the team decoder.
  An older revision of this document put the shipped assertions at four and
  printed two different percentages in two places; a count like that rots every
  time a boundary is added, which is why the instruction here is to run the
  command.
- **Type coverage ignores four entries.** TanStack Router's generator emits
  internal `as any` casts, so `routeTree.gen.ts` and the two modules that hold
  the router value it types — `src/app/router.tsx` and `src/app/main.tsx` — read
  as `any`. The fourth is `src/paraglide/**`, which is generated output. Route
  typing itself is intact and proven by the compiler: `<Link to="/unknown">` is a
  type error. Every `Link` in the app is a standing check on that, so the ignore
  entries cannot hide a regression.
- **Coverage runs on istanbul, not v8.** The v8 provider's range-tree merge
  overflows the stack on a suite this size; istanbul instruments the source
  instead and also reports branch coverage more accurately through JSX.
- **Mutation testing does not reach `shared/lib/people.ts`.** `stryker.config.json`
  mutates `src/**/model/**/*.ts` plus `shared/lib/duration.ts`, on the argument
  that `duration.ts` is model code living in `shared` only because two entity
  slices need it. `people.ts` is there for exactly that argument — it is named
  in `vitest.config.ts` beside `duration.ts` and held to the same 100% coverage
  floor — and it is not in the mutate list. Deterministic row order is a spec
  requirement, and coverage alone is the weaker of the two instruments we have
  for it.
- **The acceptance suite cannot reach either document endpoint.** It serves a static
  `dist/` through `vite preview`, and a static server runs no Netlify function,
  so the suite route-stubs `/.netlify/functions/{teams,preferences}`. Every credential rule the
  endpoint holds — that the storage key is derived from the verified subject and
  from nothing the request carried, that nothing touches the store before the
  token is checked, that a write with no precondition is refused 428 — is proved
  by the `functions` project alone. The one property no suite here can observe is
  the deployed one: that a second real reader cannot read the first's teams
  through the real function. No browser can mint an assertion for somebody else,
  so it takes two real GitLab accounts against the deployed site. It belongs to
  `release-checklist.md`, and it is unticked.
- **Three scenarios failed one local run on 2026-09-18 and were flakes.** "Insights shows
  the month…", "A failure is explained and can be retried" and "Switching
  language changes the whole screen" all timed out waiting on an element, all
  three at four workers on a machine that was also building, and all three passed
  when re-run serially. Locally `retries` is 0, so a flake is a red run rather
  than a marked one; CI retries once. The lesson is the one already recorded
  below about worker count — a red local run deserves a serial re-run before it
  deserves a bug report.
- **An interrupted Stryker run breaks `bun run lint:a11y` until it is cleaned
  up.** Stryker copies the whole project into `.stryker-tmp/sandbox-*`, `biome.json`
  with it, and Biome 2 refuses to start when it discovers a second root
  configuration anywhere beneath the first — so the ARIA gate exits 1 with
  "Found a nested root configuration" and audits nothing. `cleanTempDir` removes
  the sandboxes at the end of a run that finishes; one that is cancelled leaves
  them, and they are gitignored, so `git status` will not mention them either.
  `rm -rf .stryker-tmp` is the fix. The 114-file figure measured on 2026-09-18 was
  taken with those leftovers moved aside.
- **No Lighthouse CI.** `@lhci/cli` carries a high-severity advisory with no
  fixed upstream version, which the zero-vulnerability policy forbids.
  Performance is guarded by the `size-limit` budget and by the layout-shift
  assertion in the acceptance suite. Paint timing is not asserted: a paint time
  measured against `vite preview` on localhost measures localhost.
- **Three things run on Node, not Bun.** Stryker, whose plugin loader cannot
  resolve its own TestRunner plugins under Bun; the Playwright run itself; and
  the acceptance suite's preview server, which under `bun --bun` dies with
  `ERR_STREAM_WRITE_AFTER_END` when a browser closes a page mid-response and
  takes every scenario after that point with it. The first two are marked in
  `package.json`, the third in `playwright.config.ts`, and all three are listed
  in AGENTS.md § Runtime. This bullet said "two" until 2026-09-18; the third has
  been there since 2026-08-31.
- **CI installs with `--ignore-scripts`.** The `prepare` script installs git
  hooks, which a runner has no use for and which failed outright in the
  `oven/bun` image GitLab ran, since it ships no git. The first pipeline died there.
- **No `BUN_INSTALL_CACHE_DIR` pointing inside the checkout.** The second
  pipeline died because it did: every dependency was unpacked where
  `prettier --check .` walks, and one of them carries a config Prettier cannot
  resolve. GitLab cached `node_modules/`; GitHub Actions caches Bun's own
  download cache under the home directory, which is outside the checkout for
  the same reason.
- **GitLab's shared runner needed no identity validation.** That was the one risk in
  the plan only the account owner could clear, and it did not appear.
- **Two more pipeline failures were the suite, not the code.** The dev server did
  not answer within Playwright's default minute in a cold container, so the
  `webServer` timeout became three minutes — everywhere now, and for a cold
  build ahead of `vite preview` rather than for the dev server; and a runner has no `.env`, so
  the e2e job sets a placeholder client id — the OAuth flow is stubbed, and what
  the suite needs is a configured app rather than a real application.

The first green pipeline, **on 2026-08-22**, ran in **6.9 minutes**: verify 87s,
test 66s, e2e 273s, build 51s. That is a record of one run on that date and has
not been re-measured — read it as the order of magnitude, not as what the
pipeline costs today. The suite has grown a long way since: the same paragraph
once said 153 acceptance scenarios across three engines, where `bddgen` now
expands more than three hundred. Mutation testing is kept off the blocking path,
which is what left
room inside the 400 compute minutes a month the Free plan allows.

**CI moved to GitHub Actions on 2026-09-28**, with the repository and its whole
history. The jobs moved as they were — the same four plus the scheduled mutation
run — into `.github/workflows/`, which has since gained the release and the
pull-request and security workflows `CONTRIBUTING.md` describes. Three things changed with the move. The runtimes are the
deploy's rather than an image's: Bun from `packageManager`, Node from the major
`netlify.toml` pins, where GitLab ran a floating `oven/bun:1.4` and, for
Stryker, Debian's Node. The mutation run is in a workflow of its own and
actually runs — weekly, on Mondays — where on GitLab it waited for a pipeline
schedule that was never created. And the coverage totals are read from
`coverage-summary.json` into the job's summary, where GitLab parsed them out of
the log for its merge-request widget. The minute budget above no longer
applies: hosted runners on a public repository are not metered. The pipeline
timings above were measured on GitLab.

- **The acceptance suite runs against the built bundle, not the dev server.**
  It used to share one Vite instance across every browser, which transformed
  modules on demand — so the suite was both slow and worker-bound: Playwright's
  default worker count put more concurrent page loads on that one server than it
  could serve inside a five-second expectation, and 25 scenarios failed for that
  reason alone, every one of them WebKit. Serving `dist/` costs one build per run
  and pays for it several times over. **Measured on 2026-08-24**, on one machine
  and all three browsers: 358s against the dev server at two workers, 128s against
  the build at eight. The ceiling rose rather than vanished — at eight workers the
  WebKit keyboard walk failed once — so the worker count is Playwright's default
  locally and two in CI, which was the core count of GitLab's runner. The
  ceiling is still there: the local chromium run behind this revision took 2.4
  minutes at four
  workers and lost three scenarios to it.
- **A local run is chromium only; the matrix is CI's job.** A hundred-odd
  scenarios in each of three browsers is what a merge deserves, not what a change
  in front of you deserves. `--project=webkit` when you want it.
- **The initial-bundle figure was wrong until it was rewritten, and too low.** The
  budget globbed `dist/assets/index-*.js` plus the stylesheet — 2 of the 10 files
  `dist/index.html` actually requests. It never saw the eight `modulepreload`
  siblings the bundler emits beside the entry, so when a shared module moved out
  of the entry into one of them the recorded size fell by 27 kB while the real
  initial load did not move. `.size-limit.js` now reads the document and measures
  everything it references — 19 files today, 17 of them `modulepreload`. The true
  figure was 148.5 kB, not the 114.8 kB the table then claimed and not the 87.6 kB
  the old glob reported after the palette landed. Moving the signed-in header out
  of the root layout and into the `_authenticated` layout took it to 133.2 kB for
  real: the navigation, the colour-scheme control and their icons are in a route
  chunk a signed-out reader never loads. It reads 176.73 kB on this pass, inside the
  180 kB budget, and the teams surface is what moved it.
- **The acceptance fixture counts days in the reader's zone, not in UTC.** It used
  to place each entry at midday UTC on a day counted from UTC's today, and the
  whole suite failed every evening after 21:00 in Brazil: UTC had already rolled
  over, so "today" in the fixture was the reader's tomorrow and `today reads 6.5
hours` found yesterday's three. Four scenarios, three browsers, twelve failures,
  none of them about the code. The app buckets days in `America/Sao_Paulo`, so the
  fixture does too.
- **A weekday with a hyphen in it broke a date assertion for a week.** The step
  that checks Portuguese date formatting matched the weekday with `\p{L}+`, and
  five of the seven Portuguese weekdays carry a hyphen — `segunda-feira`. It ran
  on a Sunday and looked green. Two clock-dependent defects in one suite is a
  pattern worth naming: an assertion that only holds on some days is a failing
  assertion that has not been run yet.
- **`i18n:compile` only compiles when the catalogues have changed.** Six scripts
  depend on it through `prelint`, `pretypecheck`, `pretest`, `pretest:coverage`,
  `pretest:e2e` and `prebuild`, and each one used to rewrite every generated file
  to produce identical output — 184 files when the guard landed **on 2026-08-24**,
  353 under `src/paraglide/` today, which is two per message plus the runtime —
  which cost 3.5 seconds and, worse, made every gate that reads
  `src/paraglide/` unsafe to run beside one that writes it. The compile is now
  guarded by a fingerprint over the catalogues, the project settings, the
  compiler options and the compiler's version, and it refuses to trust that
  fingerprint when the output is missing. Output was verified byte-identical to
  the command line's across all 184 files by hashing both, when the guard landed.
  Measured back to back on the three gates that carry the hook, steady state on
  that date: 38s without the guard, 28s with it.
- **Running the gates in parallel was measured twice and rejected twice, both
  on 2026-08-24.** Before the guard it took 344s against 53s in series, because
  the gates were racing over generated sources. After the guard removed the race
  it took 33s against 29s — no advantage, because six of the gates build a
  TypeScript program of their own and contend for the machine. The end-to-end
  `verify` figure moves more with cache state than with anything either attempt
  changed, which is the honest reason there is no parallel runner in this
  repository.
- **The `pre-push` group is the exception, measured a third time on 2026-08-25
  and kept.** Five interleaved runs each, steady state: 43s in series, 22s with
  the five gates in a parallel group behind one serial `i18n:compile`. What
  changed is not the
  conclusion above but the machine it was drawn on — a Windows working copy whose
  gates spend their time waiting on file reads rather than saturating cores, so
  there is idle time for parallelism to recover. The compile stays serial and
  ahead of the group, which is what keeps the race the guard closed from
  reopening: verified by deleting `src/paraglide/.fingerprint` and watching the
  compile do the work before the group opened, with every gate inside it then
  reporting the messages current.
- **The component project shares one environment per worker (`isolate: false`).**
  Most of what the suite cost was never the assertions: importing the module
  graph and building a DOM 62 times over. Sharing them took `bun run test` from
  28 seconds to 12 and `test:coverage` from 60 to 39 — **measured on 2026-08-24**,
  when the change landed and the component project held 62 files. Not re-measured
  since, and the comparison cannot be re-run without reverting the line; what can
  be said is that the project was 70 files on 2026-09-18 and both commands still
  finished inside a minute, at 56s and 43s. The three ways
  state could cross a file boundary were probed rather than assumed — a
  deliberately leaked spy, a storage key, a switched language and a `globalThis`
  value, all in a two-file experiment forced into one worker. Spies do not
  survive a file (Vitest restores them), storage does not (the `afterEach` in
  `tests/setup/ui.ts` clears it, which is also what stops Paraglide's cached
  locale from carrying), and module scope does. That last one is survivable
  structurally rather than by luck: the tested slices hold no mutable module
  state, and the singletons that would be dangerous live in `src/app/`, which has
  no tests and which no tested slice may import — the FSD boundary rule forbids
  importing the top layer. Reverting is one line in `vitest.config.ts`, and the
  reasoning is written beside it.
- **`happy-dom`, not jsdom.** It has been the component project's environment
  since the rebuild; a note elsewhere once said otherwise.
