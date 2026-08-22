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
| Lint (ARIA, static)                | 0 errors                         | pass     | `bun run lint:a11y`             | `verify`, CI             |
| TypeScript                         | 0 errors under full strictness   | pass     | `bun run typecheck`             | pre-push, `verify`, CI   |
| FSD conventions                    | 0 problems                       | pass     | `bun run arch:layers`           | pre-push, `verify`, CI   |
| Dependency graph (cycles, orphans) | 0 violations                     | pass     | `bun run arch:graph`            | pre-push, `verify`, CI   |
| Dead code (files, exports, deps)   | 0 findings                       | pass     | `bun run deadcode`              | pre-push, `verify`, CI   |
| Type coverage                      | ≥ 99%                            | 99.85%   | `bun run types:coverage`        | `verify`, CI             |
| Dependency vulnerabilities         | **0, at any severity**           | 0        | `bun run security:audit`        | pre-push, `verify`, CI   |
| Test coverage, statements          | ≥ 90%                            | 100%     | `bun run test:coverage`         | CI                       |
| Test coverage, branches            | ≥ 90%                            | 98.5%    | `bun run test:coverage`         | CI                       |
| Test coverage, `model/`            | **100%**                         | 100%     | `bun run test:coverage`         | CI                       |
| Mutation score, `model/`           | ≥ 85%                            | 96.80%   | `bun run test:mutation`         | scheduled CI             |
| Initial bundle                     | ≤ 180 kB gzip                    | 114.6 kB | `bun run build && bun run size` | CI                       |
| Accessibility (WCAG 2.1 AA)        | 0 axe violations, light and dark | pass     | `bun run test:e2e`              | CI                       |

Tests: 717 unit and component, 300 of them on the pure model layer and its Gherkin
features, plus 39
acceptance runs across chromium, webkit and a mobile viewport.

## Two linters, on purpose

ESLint carries the rules that need type information and the ones that need to
understand React, tests or this project's layers. Biome carries the ARIA rules
and nothing else.

The split is not a hedge. Biome checks 349 files in under 300 ms where ESLint
takes 33 seconds, and swapping wholesale was measured and rejected: the rules
that caught real defects in this codebase have no Biome equivalent —
`restrict-template-expressions`, `unbound-method`,
`react-hooks/set-state-in-effect` (a real bug in the auth callback),
`testing-library/no-node-access`, the `sonarjs` and `unicorn` sets, and
`perfectionist`'s object and module ordering. Biome 2.4's `types` domain covers
three of those type-aware rules, and Biome's own release notes put
`noFloatingPromises` at roughly 75% of typescript-eslint's accuracy. Trading a
proven gate for a faster one is not a trade.

The speed problem had a cheaper answer: `eslint --cache` takes 3.9 seconds warm
instead of 33. Biome earns its place for the one thing it alone catches — an
`aria-label` on a generic element, which `jsx-a11y` and axe both let through. Two
of its recommended ARIA rules are off, with the reason in `biome.json`:
`useSemanticElements` asks for a `<fieldset>` wherever it sees `role="group"`,
and `noLabelWithoutControl` cannot see through the shadcn `Label` wrapper.

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
  Performance is guarded by the `size-limit` budget and, once the acceptance
  suite covers it, by Web Vitals asserted in Playwright.
- **Two tools run on Node, not Bun.** Stryker (its plugin loader cannot resolve
  plugins under Bun) and the Playwright run. Both are marked in `package.json`.
