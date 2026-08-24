# Test plan

What this project tests, at which level, and what each level is deliberately not
responsible for. The rule behind every choice below: a test belongs at the
cheapest level that can actually observe the behaviour, and nowhere else.

## The four levels

### 1. The model, as functions

`src/**/model/**` holds every rule this product has: converting seconds to hours,
deciding which calendar day an instant belongs to, grouping days, rolling up
projects and work items, the daily target and the balance against it, the PKCE
challenge, and token lifetimes. Lint forbids that layer from importing React,
`@tanstack/*`, anything under `api/`, the message catalogues, or touching
`fetch`, `window` or `localStorage`.

That purity is what makes the level cheap: no DOM, no network, no doubles.
Coverage is held at **100%** and the mutation score above **85%**, because on
pure functions both are affordable rather than aspirational.

**Responsible for:** every arithmetic and calendar rule, and every branch of it.
**Not responsible for:** anything a reader sees. A model test never renders.

### 2. Gherkin over the model

`features/domain/*.feature`, run by `@amiceli/vitest-cucumber` with step
definitions in `tests/domain/`. These exist so the rules that matter most are
written in the language of the requirement rather than of the function — hours
from seconds, which day an entry belongs to, when a period total is settled, the
target and the balance.

**Responsible for:** traceability from an OpenSpec requirement to a runnable
assertion on the rule.
**Not responsible for:** coverage. It overlaps the unit tests on purpose.

### 3. Components and adapters

`src/**/*.test.tsx` for what renders, `src/**/api/*.test.ts` for what talks to
GitLab, with MSW intercepting the GraphQL endpoint using fixtures shaped from a
real recorded response. Screens are rendered against a fake gateway, so a test
states what the reader sees for a given set of hours.

**Responsible for:** the states a screen can be in — loading, loaded, empty,
failed, refreshing, unsettled — and that each is distinguishable from the others.
**Not responsible for:** whether the browser lays it out correctly, whether the
colours pass contrast, or whether a real screen reader announces it. A component
test computes an accessible name; it does not check that the platform would.

### 4. Acceptance, in real browsers

`features/acceptance/*.feature`, run by `playwright-bdd` across chromium, webkit
and a Pixel 7 viewport, with `axe-core` assertions on every route in both colour
schemes. The OAuth flow runs against a stubbed authorize endpoint, so no
credential is needed; the GraphQL endpoint is stubbed with fixed figures, so the
suite asserts on numbers rather than on the presence of a number.

**Responsible for:** the reader's actual experience — signing in and out, reading
the week, opening a day, deep links surviving a reload, keyboard operability with
a visible focus indicator, no sideways scrolling at 375 pixels, cumulative layout
shift, and a return visit painting from cache without asking GitLab.
**Not responsible for:** arithmetic. If a total is wrong, that is a model bug and
a model test should have failed first.

## What no level covers, and why

- **Production paint timing.** The acceptance suite runs against the dev server,
  where a paint time means nothing. Layout shift is asserted because it is a
  layout property and holds in either mode; the size of what has to be
  downloaded is guarded by the `size-limit` budget instead.
- **A real GitLab account.** Every suite stubs the API. The figures the app
  computes were cross-checked by hand against the live account once, and that
  check belongs to `release-checklist.md`, not to an automated suite that would
  depend on somebody's hours not changing.
- **A real screen reader.** Automated axe checks structure, not experience.
  `accessibility-audit.md` holds the manual procedure.
- **Two people on one device.** Signing out clears the cache and the acceptance
  suite proves the next sign-in starts empty, but nothing tests concurrent
  sessions, because the app has none.

## Running them

```bash
bun run verify        # format, lint, ARIA, types, architecture, dead code, audit
bun run test          # levels 1 to 3
bun run test:coverage # the same, with the thresholds enforced
bun run test:e2e      # level 4
bun run test:mutation # level 1, by mutation
```
