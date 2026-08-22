# Quality metrics

Every metric below has a target, a command that measures it, and a place that
enforces it. A metric nobody enforces is a wish, not a metric.

The "measured" column records the value at the last update of this document, so
a drift is visible without running anything.

## Enforced gates

| Metric                             | Target                           | Measured | Command                         | Enforced at              |
| ---------------------------------- | -------------------------------- | -------- | ------------------------------- | ------------------------ |
| Formatting                         | no deviation                     | pass     | `bun run format:check`          | pre-commit, `verify`, CI |
| Lint (type-aware)                  | 0 errors, 0 warnings             | pass     | `bun run lint`                  | pre-commit, `verify`, CI |
| Lint (ARIA and element ids)        | 0 errors                         | pass     | `bun run lint:a11y`             | `verify`, CI             |
| TypeScript                         | 0 errors under full strictness   | pass     | `bun run typecheck`             | pre-push, `verify`, CI   |
| FSD conventions                    | 0 problems                       | pass     | `bun run arch:layers`           | pre-push, `verify`, CI   |
| Dependency graph (cycles, orphans) | 0 violations                     | pass     | `bun run arch:graph`            | pre-push, `verify`, CI   |
| Dead code (files, exports, deps)   | 0 findings                       | pass     | `bun run deadcode`              | pre-push, `verify`, CI   |
| Requirement traceability           | every requirement cited          | 41/41    | `bun run arch:trace`            | `verify`, CI             |
| Type coverage                      | ≥ 99%                            | 99.83%   | `bun run types:coverage`        | `verify`, CI             |
| Dependency vulnerabilities         | **0, at any severity**           | 0        | `bun run security:audit`        | pre-push, `verify`, CI   |
| Test coverage, statements          | ≥ 90%                            | 100%     | `bun run test:coverage`         | CI                       |
| Test coverage, branches            | ≥ 90%                            | 99.09%   | `bun run test:coverage`         | CI                       |
| Test coverage, `model/`            | **100%**                         | 100%     | `bun run test:coverage`         | CI                       |
| Mutation score, `model/`           | ≥ 85%                            | 97.34%   | `bun run test:mutation`         | scheduled CI             |
| Initial bundle                     | ≤ 180 kB gzip                    | 114.8 kB | `bun run build && bun run size` | CI                       |
| Accessibility (WCAG 2.1 AA)        | 0 axe violations, light and dark | pass     | `bun run test:e2e`              | CI                       |
| Cumulative layout shift            | < 0.1, cold and warm             | pass     | `bun run test:e2e`              | CI                       |
| No sideways scrolling at 375 px    | every screen                     | pass     | `bun run test:e2e`              | CI                       |

Tests: 718 unit and component, 300 of them on the pure model layer and its Gherkin
features, plus 144 acceptance runs across chromium, webkit and a mobile viewport.

## Two linters, on purpose

ESLint carries the rules that need type information and the ones that need to
understand React or the test libraries. Biome carries the ARIA rules and the
unique-id rule, and nothing else.

Replacing ESLint outright was measured against Biome 2.5.10, twice — the first
attempt was wrong and is worth recording, because the mistake is easy to repeat.
Running `biome lint --config-path <elsewhere> src` reports nothing from the
type-aware rules: the project scanner anchors on the directory holding the
config, so with the config outside the project it has no project to scan and the
rules silently find nothing. From the repository root they work.

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

- **`testing-library/*` — nothing.** Biome has no rule from that plugin. A third
  of the tests here are component tests, and `no-node-access` is what stopped a
  test from walking the DOM, which is how the ARIA bug below came to light.
- **`react-hooks/set-state-in-effect` — nothing.** Biome ships four rules from
  `eslint-plugin-react-hooks`; that is not one of them. It caught a real bug in
  the OAuth callback.
- The four type-aware rules in the table above.

And `noFloatingPromises` sits in the nursery group, which Biome documents as not
subject to semantic versioning.

The speed argument, measured: ESLint 33 s cold and **3.9 s warm with `--cache`**;
Biome 2 s with the project scan, 300 ms without. Cold CI runs are 33 s against
2 s. Thirty seconds of CI is not worth three rules that have each found a real
defect in this repository.

Biome earns its place for what it alone catches. It found an `aria-label` on a
generic element in four files — prohibited ARIA, so every screen reader ignored
it — which `jsx-a11y` and the axe assertions both let through. It also found two
hardcoded `id` attributes behind `aria-labelledby`, which work only while each
section renders once. Two of its recommended ARIA rules are off, with the reason
in `biome.json`: `useSemanticElements` asks for a `<fieldset>` wherever it sees
`role="group"`, and `noLabelWithoutControl` cannot see through the shadcn `Label`
wrapper.

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

`vitest.config.ts` scopes coverage to authored logic: `entities`, `features`,
`widgets`, `pages`, `shared/lib`, `shared/i18n` and the components we author in
`shared/ui`. Excluded, with reasons:

- `src/app/**` — router and provider wiring, exercised end to end by the
  Playwright acceptance suite instead.
- `src/shared/ui/{button,card,input,label}.tsx` — generated by the shadcn CLI.
  We do not author them, so covering them would measure someone else's code.
  The list is explicit rather than a directory glob, so a component we write in
  `shared/ui` is still measured; `select-field.tsx` is.
- `src/paraglide/**` and `src/app/routeTree.gen.ts` — generated output.

A line that is hard to cover is a design signal. Moving code out of a covered
path to make a number go up is not an acceptable fix.

## Coverage is a floor, not a target

The thresholds are 90% overall and 100% on `model/`. Measured coverage sits near
100% everywhere, and that gap is worth naming: nothing forced it, and chasing it
is not free.

100% on `model/` is right. That layer is pure functions with no I/O, it is where
a wrong hour figure comes from, and mutation testing on the same files shows the
tests actually assert rather than merely execute. A hard-to-cover line there is a
design signal, not an excuse.

Outside `model/`, the last few branches are not chased. A branch is worth a test
when a reader would notice it being wrong — a period with no target, a day split
across two pages, a refused credential. A branch is not worth a test when the
only way to reach it is to defeat the type system, and a test written to reach it
asserts nothing a reader cares about. Two such tests were written during this
change and removed again: they asserted that a number was printed, in order to
reach a `??` fallback that the surrounding arithmetic makes unreachable.

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

- **Seven surviving mutants are equivalent mutants, not test gaps.** Every one
  is a type guard TypeScript requires but that carries no behaviour: narrowing
  `unknown` before a spread in `parseObject` and `dailyTargetFrom`, and
  `typeof value === 'number'` before `isValidTargetHours`, whose
  `Number.isFinite` already rejects non-numbers. Removing them to raise the
  score would mean weakening the types. Do not "fix" them.
- **Type coverage ignores three files.** TanStack Router's generator emits
  internal `as any` casts, so the router value reads as `any` to
  `type-coverage`. Route typing itself is intact and proven by the compiler:
  `<Link to="/unknown">` is a type error. Every `Link` in the app is a standing
  check on that, so the ignore entry cannot hide a regression.
- **Four `as` assertions remain**, each a smart constructor or a boundary the
  type system cannot see through: branding a validated `IsoDate`, narrowing a
  native select's value to the union it was rendered from, and two in test
  support code. They are why type coverage is 99.91% rather than 100%.
- **Coverage runs on istanbul, not v8.** The v8 provider's range-tree merge
  overflows the stack on a suite this size; istanbul instruments the source
  instead and also reports branch coverage more accurately through JSX.
- **No Lighthouse CI.** `@lhci/cli` carries a high-severity advisory with no
  fixed upstream version, which the zero-vulnerability policy forbids.
  Performance is guarded by the `size-limit` budget and by the layout-shift
  assertion in the acceptance suite. Paint timing is not asserted: the suite runs
  against the dev server, where a paint time measures the dev server.
- **Two tools run on Node, not Bun.** Stryker (its plugin loader cannot resolve
  plugins under Bun) and the Playwright run. Both are marked in `package.json`.
- **CI installs with `--ignore-scripts`.** The `prepare` script installs git
  hooks, which a runner has no use for and which fail outright in the `oven/bun`
  image, since it ships no git. The first pipeline died there.
- **No `BUN_INSTALL_CACHE_DIR` pointing inside the checkout.** The second
  pipeline died because it did: every dependency was unpacked where
  `prettier --check .` walks, and one of them carries a config Prettier cannot
  resolve. What is cached is `node_modules/`.
- **The shared runner needed no identity validation.** That was the one risk in
  the plan only the account owner could clear, and it did not appear.
