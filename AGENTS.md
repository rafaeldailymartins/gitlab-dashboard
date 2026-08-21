# AGENTS.md

Personal dashboard of hours logged in GitLab issues and merge requests. Read
`README.md` for setup and the GitLab OAuth application it needs.

**Everything in this repository is written in English** — code, comments, commit
messages, documentation, Gherkin features. User-facing strings never appear as
literals; they live in `messages/{en,pt-BR}.json` and reach the UI through
Paraglide.

## Commands

| Command                           | What it does                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| `bun run dev`                     | Dev server on http://localhost:3000                                                           |
| `bun run verify`                  | Every fast gate: format, lint, types, architecture, dead code, type coverage, vulnerabilities |
| `bun run test`                    | Unit and component tests (`domain` + `ui` Vitest projects)                                    |
| `bun run test:coverage`           | Same, with coverage thresholds enforced                                                       |
| `bun run test:e2e`                | Generates specs from `features/acceptance/*.feature`, then runs Playwright                    |
| `bun run test:mutation`           | Stryker mutation testing on the model layer                                                   |
| `bun run build` && `bun run size` | Production build and the 180 kB gzip budget                                                   |

Run `bun run verify && bun run test` before calling any change finished.

### Runtime

Bun is the package manager, script runner and runtime. Two exceptions, both
deliberate and both marked in `package.json`:

- **Stryker runs on Node** (`node ./node_modules/@stryker-mutator/core/bin/stryker.js`).
  Its plugin loader cannot resolve its own TestRunner plugins under Bun.
- **Playwright runs on Node.** `bddgen` runs on Bun; the test run does not.

Everything else uses `bun --bun`. `bunfig.toml` is deliberately absent: a global
`[run] bun = true` symlinks `node` to Bun, which silently breaks the two tools
above.

## Architecture

Feature-Sliced Design on the outside, Clean Architecture inside each slice.

```
src/
  app/          router, providers, global styles, and routes/ (TanStack Router
                file-based routing lives inside the app layer, because route
                files are wiring)
  pages/        screen composition
  widgets/      composed UI blocks
  features/     single user interactions
  entities/     domain slices
    timelog/
      model/    PURE business rules and ports. No React, no I/O, no strings.
      api/      adapters: GitLab GraphQL gateway, zod schemas, query options
      ui/       slice-level components
      index.ts  public API — import from here, never from internals
  shared/       ui (shadcn), lib, i18n, config
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
| ≥ 99% of expressions carry a real type                                                                                              | `type-coverage`                                       |
| Zero dependency vulnerabilities, at any severity                                                                                    | `bun audit`                                           |
| Named exports only                                                                                                                  | `no-restricted-exports`                               |

When a gate fails, fix the cause. Raising a ceiling or adding an ignore entry
requires a comment saying why, in the config, next to the change.

## Conventions

- **Types**: `strict` plus every optional check (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `erasableSyntaxOnly`, …). No `any`, no
  non-null assertions to silence the compiler.
- **Formatting**: Prettier decides. Never hand-format.
- **Imports**: sorted by `perfectionist`; run `bun run lint:fix`.
- **UI components**: add them with `bunx shadcn@latest add <name>`; they land in
  `src/shared/ui` (style `base-nova`, Base UI primitives). Do not hand-write
  what the CLI generates.
- **Design tokens**: CSS custom properties in `src/app/styles.css`. Light values
  on `:root`, dark on `.dark`. Never hardcode a colour in a component.
- **Time**: GitLab reports seconds. Convert with `secondsToHours` and accumulate
  in seconds, so rounding never compounds.
- **Commits**: Conventional Commits, enforced by commitlint on commit-msg.

## Tests

- `features/domain/*.feature` — business rules, run by `@amiceli/vitest-cucumber`
  with step definitions in `tests/domain/`.
- `features/acceptance/*.feature` — user flows in a real browser, run by
  `playwright-bdd` with step definitions in `tests/e2e/steps/`, including
  `axe-core` accessibility assertions.
- `src/**/*.test.ts(x)` — unit and component tests, co-located.
- Every `Scenario` carries a `# Spec: <capability> / <requirement>` comment
  linking it back to the OpenSpec requirement it covers.

Coverage: 90% overall on authored logic, **100% on `model/`**. Mutation score on
`model/` must stay above 85%. `docs/qa/quality-metrics.md` records every
gate, its target and where it is enforced.

## Planning

Changes are planned with OpenSpec (`openspec/`) before they are implemented:
proposal → specs → design → tasks. Use the OpenSpec CLI, not hand-edited files.

Never create issues or epics in any tracker without being asked.
