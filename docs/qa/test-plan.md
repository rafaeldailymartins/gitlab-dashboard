# Test plan

What this project tests, at which level, and what each level is deliberately not
responsible for. The rule behind every choice below: a test belongs at the
cheapest level that can actually observe the behaviour, and nowhere else.

## The five levels

### 1. The model, as functions

`src/**/model/**` holds every rule this product has: converting seconds to hours,
deciding which calendar day an instant belongs to, grouping days, rolling up
projects and work items, the daily target and the balance against it, the PKCE
challenge, token lifetimes, the expiry read out of an identity assertion — the
token's own `exp`, which is not the access token's `expires_in` — every edit a
reader can make to a team, deduplicating suggested people by the provider's
identifier rather than by their username, and decoding a stored team back into
one. Lint forbids that layer from importing React, `@tanstack/*`, anything under
`api/`, the message catalogues, or touching `fetch`, `window` or `localStorage`.

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

`src/**/*.test.tsx` for what renders, `src/**/api/*.test.ts` for what talks to a
provider — and there are three of those now. MSW intercepts GitLab's GraphQL
endpoint using fixtures shaped from a real recorded response, and it intercepts
both document endpoints as well: `src/entities/teams/api/teams-gateway.test.ts`
and `src/entities/preferences/api/preferences-gateway.test.ts` keep the request
that went out and read it back, so what the browser half of each endpoint sends
is asserted rather than assumed — the identity assertion and nothing else beside
it, the version a write names in `x-document-version`, `*` on a first write,
and one renewal and retry after a refusal rather than a loop. Where the two differ is
the whole point of having both: a refused teams write is reported to the reader,
and a refused settings write is resolved without them, in one bounded retry that
compares the instants and stops. Screens are rendered
against a fake gateway, so a test states what the reader sees for a given set of
hours.

**Responsible for:** the states a screen can be in — loading, loaded, empty,
failed, refreshing, unsettled — and that each is distinguishable from the others.
**Not responsible for:** whether the browser lays it out correctly, whether the
colours pass contrast, or whether a real screen reader announces it. A component
test computes an accessible name; it does not check that the platform would. Nor
what either endpoint makes of a request: this level settles what goes out,
level 4 settles what comes back.

### 4. The serverless functions, with the platform outside

`netlify/**/*.test.mts`, the `functions` Vitest project: environment node, no
DOM, no React, and no Netlify. The blob store and the identity verifier are
ports, so a test injects an in-memory store and a locally minted RS256 key pair
rather than reaching for `getStore`, which throws outside a Netlify environment,
or for the provider's published keys, which would put a network between an
assertion and the assertion about it.

It is a level of its own because nothing else can see what it sees. Level 3
stubs the endpoint, and level 5 serves a static `dist/`, which has no function
in it. So the rules carrying the security of the whole feature are proved here
or nowhere: that the storage key is built from a subject the signature
established and from nothing the request carried — plus a suffix the function
module chooses, which is what keeps one reader's two documents apart without
letting a request name either — so one reader addressing another's anything is
not expressible rather than merely refused; that nothing
touches the store until the credential is checked, which is what makes an
unauthenticated request cost one verification against a warm key set and no
store access at all; that a write carrying no `x-document-version` is refused
428 instead of replacing a document its sender
never read; and that a signature from a key the provider does not publish — or
an assertion for another application, from another issuer, expired, or minted
long ago under a generous expiry — is not an identity.

`document-endpoint.test.mts` is about the three ways an endpoint answers
before the handler is reached at all — no application id, a provider that will
not publish its keys, and a discovery that failed and must not be remembered.
That last one was a copy in two function files and tested in neither.

Two more tests in it are not about a request at all. `teams-contract.test.mts` and
`preferences-contract.test.mts` run the browser's lenient codec beside the
endpoint's strict validator over one table of documents, because the two live in
different layers and different runtimes and nothing else makes them meet. They
are allowed to disagree in exactly one direction — everything the browser writes,
the endpoint accepts — and the other direction is a reader who cannot save.

**Responsible for:** what each endpoint accepts, what it refuses, which of the
two costs anything, and that the browser never writes something it will refuse.
**Not responsible for:** the platform. That Netlify's blob store honours
`onlyIfMatch` and `onlyIfNew` is its claim, and a double injected in its place
cannot make that claim on its behalf; the adapter over it holds no rule worth a
test.

### 5. Acceptance, in real browsers

`features/acceptance/*.feature`, run by `playwright-bdd` — in CI across chromium,
webkit and a Pixel 7 viewport, locally in chromium alone — with `axe-core` assertions on every route in both colour
schemes. The OAuth flow runs against a stubbed authorize endpoint, so no
credential is needed; the GraphQL endpoint is stubbed with fixed figures, so the
suite asserts on numbers rather than on the presence of a number. The teams and
preferences endpoints are stubbed through `page.route` too, and not for convenience: the suite
builds and serves `dist/` through `vite preview`, so there is nothing behind
those paths to answer.

**Responsible for:** the reader's actual experience — signing in and out, reading
the week, opening a day, keeping a team and reporting on it, scoping that report
to a group and clearing the scope again, deep links surviving a reload, keyboard
operability with a visible focus indicator, no sideways scrolling at 375 pixels,
cumulative layout shift, a return visit painting from cache without asking
GitLab, and nothing of a colleague's being left on the device to paint from.
**Not responsible for:** arithmetic. If a total is wrong, that is a model bug and
a model test should have failed first. Nor either endpoint's rules, which it
cannot reach at all: level 4 holds them.

## What no level covers, and why

- **Production paint timing.** The acceptance suite serves the built bundle, but
  it serves it from `vite preview` on localhost — no network between the browser
  and the artefact, no CDN, no cold cache — so a paint time measured there says
  nothing about a deploy. Layout shift is asserted because it is a layout
  property and holds either way; the size of what has to be downloaded is
  guarded by the `size-limit` budget instead.
- **A real GitLab account.** Every suite stubs the API. The figures the app
  computes were cross-checked by hand against the live account once, and that
  check belongs to `release-checklist.md`, not to an automated suite that would
  depend on somebody's hours not changing.
- **That the unscoped reach really is unscoped.** A fixture returns what it was
  written to return, so a test showing a personal project's hours in somebody's
  row proves that the stub offered them and nothing further. What
  `users(ids:) { timelogs }` will really show this reader about another person
  can only be read off a real account: one row, one month, checked by hand
  against a month that contains both a project the reader cannot open and a work
  item with no project — the two shapes that decide whether the row's total and
  the shortfall beside it are right. Like the check above, it belongs to
  `release-checklist.md`.
- **A real screen reader.** Automated axe checks structure, not experience.
  `accessibility-audit.md` holds the manual procedure.
- **A second real account.** That one reader cannot read another's teams rests
  on the storage key being derived from a verified subject, and level 4 proves
  the handler does that by verifying for two injected identities. The deployed
  function is out of reach: no browser can mint an assertion for somebody else,
  so nothing short of two real GitLab accounts against the deployed site can
  observe the property end to end. It belongs to `release-checklist.md`, and it
  is the only check here that needs a second person.
- **Two people on one device.** Signing out clears the cache and the acceptance
  suite proves the next sign-in starts empty, and nothing tests concurrent
  sessions because the app has none. Half of this question is no longer on the
  device at all: which teams the second reader sees is decided by the subject in
  their own assertion rather than by anything the browser kept, which is why the
  bullet above is what would catch that being wrong.

## Running them

```bash
bun run verify        # format, lint, ARIA, contrast, translations, types, architecture, traceability, dead code, type coverage, audit
bun run test          # levels 1 to 4
bun run test:coverage # the same, with the thresholds enforced
bun run test:e2e      # level 5
bun run test:mutation # level 1, by mutation
```
