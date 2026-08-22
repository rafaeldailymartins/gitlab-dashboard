## Context

See `proposal.md` — Why for the motivation. What shapes the approach are four
properties of GitLab's API, each verified against `gitlab.com` before this design
was written rather than assumed from documentation:

| Verified                                                                                                                                                           | How                                      | Result                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------- |
| `Query.timelogs` and `CurrentUser.timelogs` both accept `startDate`, `endDate`, `username`, `sort`, `first`, `after`                                               | GraphQL introspection of the live schema | The query can be scoped to one person server-side                       |
| `startDate` and `endDate` are **truncated to UTC calendar dates**: `startDate: 2026-08-20T16:00:00Z` still matches an entry recorded at `2026-08-20T15:00:00Z`     | live query against both boundaries       | A period asked of GitLab is a window of UTC days, not the reader’s days |
| Both arguments are **optional**: omitting them returns the whole history, newest first with `sort: SPENT_AT_DESC`                                                  | live query with no dates                 | The request carries no period at all, and periods are cut locally       |
| A 30-day window for a real user returned **30 entries / 122.3 h in 571 ms**                                                                                        | live query with `first: 3`               | One page of `first: 100` covers roughly a month                         |
| `POST /api/graphql` and `POST /oauth/token` both answer with `Access-Control-Allow-Origin: *`, and the GraphQL preflight allows the `authorization` request header | CORS preflight against both endpoints    | A browser can complete OAuth and query the API with no server           |
| `Timelog` exposes `spentAt`, `timeSpent`, `summary`, `user`, `issue`, `mergeRequest`, `note` and a non-null `project`                                              | GraphQL introspection                    | Everything the report needs comes from one query                        |

The repository already carries the toolchain this design assumes: Bun, Vite,
React 19, TanStack Router and Query, Tailwind v4, shadcn/ui on Base UI, Paraglide
and the quality gates in `docs/qa/quality-metrics.md`.

## Goals / Non-Goals

**Goals:**

- Interactions that feel instant: the dashboard paints from cache, and a cold
  fetch is one network round trip to GitLab.
- No secret anywhere in the repository, the build output or a server.
- Business rules that are testable without a browser, a network or a test double.
- A shape that a group-level view can be added to later without rewriting the
  data layer.

**Non-Goals:**

- Server-side rendering. The whole app is behind a login and has no crawlable
  content, so SSR would add a deploy target and a cold start for nothing.
- A shared cache between users or devices. There is no server to hold one.
- Offline write support. The app is read-only.
- Any abstraction over GitLab meant to support a second provider. There is one
  provider; a port exists to keep the model pure, not to anticipate Jira.

## Decisions

### 1. A static SPA with no backend, instead of server functions

The previous version used TanStack Start server functions purely to keep a token
out of the browser. Once the token belongs to the person using the app, that
reason disappears, and the CORS evidence above shows the browser can talk to
GitLab directly.

What this buys: one network hop instead of two, no serverless cold start, no
database, no runtime configuration, and a deploy that is a folder of files on a
CDN.

What it costs: the OAuth access token lives in the page. Section 3 addresses that.

Alternatives considered:

- **TanStack Start + better-auth + Postgres.** Keeps the token server-side, which
  is stronger against XSS, but adds a database, a serverless function on the path
  of every request, and a cold start measured in hundreds of milliseconds — the
  exact latency this rebuild exists to remove.
- **A single serverless function for the OAuth exchange only.** Protects a client
  secret the app does not need (a PKCE public client has none) and, because the
  resulting cookie must be `httpOnly`, forces data requests through a proxy too —
  inheriting the cold start without gaining the database.

### 2. OAuth 2.0 Authorization Code with PKCE, as a public client

The GitLab application is created non-confidential, so there is no client secret
to protect, and the client id is public by design — it ships in the bundle. The
requested scope is `read_api`: the app has no write path, and a read-only
credential is the smallest useful authority.

The flow is the standard one: a random verifier and an `S256` challenge generated
with `crypto.getRandomValues` and `crypto.subtle.digest`, a random `state` used as
the anti-forgery value, both held in `sessionStorage` until the callback consumes
them. A callback whose `state` does not match a pending request is refused
without establishing a session.

Alternative considered: **implicit flow** — obsolete, returns the token in the URL
fragment, and GitLab discourages it.

### 3. Where each credential lives

| Credential           | Location                                  | Why                                                                                   |
| -------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Access token (2 h)   | A module-level variable, never serialised | An XSS payload has to run while the tab is open to reach it, and it dies with the tab |
| Refresh token        | `localStorage`, replaced on every use     | The only way a browser-only client stays signed in across visits                      |
| Verifier and `state` | `sessionStorage`, deleted on callback     | Needed only between the redirect out and the redirect back                            |

GitLab issues a new refresh token on each renewal, so the stored value is
replaced as part of the same operation that consumes it; a renewal GitLab refuses
ends the session and clears the store.

Renewal is proactive (scheduled shortly before expiry) and reactive (on a
`401`), and is **single-flight**: concurrent failures share one renewal promise
and are all retried with its result. Without that, opening the app with four
queries in flight produces four renewals, three of which invalidate the others'
rotated token.

Alternative considered: **no persistence, silent re-authorization on each visit.**
Stores nothing, but costs a full-page redirect on every cold start — a visible
flash and a few hundred milliseconds against the one thing this rebuild is for.

### 4. Query shape: scoped to the person, and carrying no period

```graphql
query MyTimelogs($first: Int!, $after: String) {
  currentUser {
    timelogs(sort: SPENT_AT_DESC, first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        spentAt
        timeSpent
        summary
        project {
          name
          fullPath
          webUrl
        }
        issue {
          title
          webUrl
          reference(full: true)
        }
        mergeRequest {
          title
          webUrl
          reference(full: true)
        }
      }
    }
  }
}
```

No group and no project id. Omitting them is what makes the report cover every
project the person logged time in, which the previous version could not do.

**No `startDate` or `endDate` either**, which is the one place this design
departs from the obvious shape. GitLab truncates both arguments to UTC calendar
dates — verified: `startDate: 2026-08-20T16:00:00Z` still matches an entry
recorded at `2026-08-20T15:00:00Z`, and `endDate: 2026-08-21T14:00:00Z` still
matches entries recorded at `2026-08-21T15:00:00Z`. So a period asked of GitLab
is a window of **UTC days**, while a day on screen is a day in the reader's zone.
The two do not line up, and `count` and `totalSpentTime` on the connection would
describe the window GitLab filtered rather than the period on screen — a total
that disagrees with the days below it by exactly the hours logged on the boundary
days.

Reading newest first instead makes the ordering do the work. Today, this week and
this month are the newest entries there are, so they arrive in the first page;
periods are cut from the loaded entries where the reader's zone is known; and the
figures always agree with the days they are made of. A page of 100 entries is
about a season of one person's logging — this account has **62 entries in total**,
all in one page — so the common case is one request for everything the dashboard
summarises, and older history extends the same cache entry as the reader scrolls.

For the rare month that spans more than a page, `periodSummary` reports whether a
period is **settled**: a total whose loaded history does not reach past the start
of the period is a floor, is marked as such, and the query keeps loading until it
is not. A figure that quietly understated the reader's hours would be worse than
one that says it is still counting.

Responses are parsed with `zod` at the adapter boundary, so a schema change on
GitLab's side surfaces as one clear error naming the field instead of an
`undefined` reaching a component and rendering as a blank hour figure.

### 5. Days are bucketed in the reader's time zone

`spentAt` is an instant, not a calendar date — observed as `2026-08-20T15:00:00Z`
for time logged on the 20th, and as `2026-08-21T21:53:46Z` for another entry, so
the time of day is real rather than a fixed hour. Which calendar day an instant
belongs to therefore depends on the reader's time zone, and getting it wrong
moves hours from one day to another: the most likely way this product could
quietly lie.

`toIsoDate(instant, timeZone)` in `shared/lib/date` is the only place an instant
becomes a day, and `dayTotals` is the only caller that matters. Date arithmetic —
week and month boundaries, day stepping — runs on **date-fns 4** over a
UTC-pinned `TZDate`, so a result never depends on the machine's own zone.
Display formatting stays on `Intl`, bound to the active locale, because that is
where the locale-aware month and weekday names already come from.

Alternative considered: **`Intl.DateTimeFormat` for arithmetic too.** It can
extract a day in a zone, which is all `toIsoDate` needs, but week and month
boundaries would then be hand-rolled around it — and hand-rolled leap-year and
month-length code is exactly what a library should be trusted with.

### 6. The cache is the first paint

TanStack Query is configured with a 5-minute `staleTime` and a 24-hour `gcTime`,
and its cache is persisted to IndexedDB. On a return visit the last known report
renders before any request is issued and is then revalidated in the background.
This is what turns "fast" into "already there", and it is the single largest
perceived-performance decision in this design.

IndexedDB rather than `localStorage`: the writes are asynchronous, so persisting a
report never blocks the main thread, and the size limits are not a concern.

Signing out clears the persisted cache, so one person's hours never appear to the
next person on a shared device.

### 7. Layers, and where purity is enforced

Feature-Sliced Design outside, Clean Architecture inside each slice, using FSD's
own segment names because both linters understand them:

```
entities/timelogs/
  model/    pure: day bucketing, aggregation, target and balance arithmetic,
            the TimelogGateway port
  api/      adapter: the GraphQL client, the zod schemas, the query options
  index.ts  the only import surface
entities/sessions/
  model/    pure: PKCE verifier and challenge, token lifetime arithmetic
  api/      adapter: the OAuth calls, the token stores
```

`model/` is where every rule this product actually has lives, and lint forbids it
from importing React, `@tanstack/*`, anything under `api/`, the i18n catalogues,
or touching `fetch`, `window`, `localStorage` or `sessionStorage`. That is not
ceremony: it is what lets the hour arithmetic, the day boundaries and the target
maths be tested as functions, which is why 100% coverage and an 85% mutation
score on that layer are affordable rather than aspirational.

The gateway port exists so the model and the query layer can be exercised without
HTTP, not to abstract over a hypothetical second provider.

### 8. Compile-time i18n

Paraglide compiles each message into a tree-shakeable function, so a screen ships
only the strings it uses, there is no catalogue fetch, and a missing translation
is a build error rather than a key leaking to a reader. Language resolution is
explicit choice in `localStorage`, then `navigator.languages`, then English.

Alternative considered: **react-i18next** — the familiar choice, but roughly 40 kB
of runtime, catalogues loaded at runtime, and no compile-time guarantee that a key
exists.

### 9. Theme resolved before the first paint

A small inline script in `index.html` reads the stored choice, falls back to
`prefers-color-scheme`, and sets a class on the root element before the bundle
loads. Anything that runs after React mounts is too late: the reader sees a flash.
The React provider then owns the same state for the toggle and listens for system
changes while no explicit choice is stored.

### 10. Charts

The week strip, the month heatmap and the project split use shadcn/ui's chart
components over Recharts, for consistent axes, tooltips and legends. Recharts is
around 95 kB gzipped, so it is loaded lazily: it is not part of the initial chunk,
and the 180 kB budget in `docs/qa/quality-metrics.md` guards that. Small marks
that are not really charts — a day row's proportional bar, a progress ring — stay
as plain CSS or inline SVG rather than dragging a chart library into a list item.

### 11. Netlify, with a SPA fallback

Static publish of `dist/`, `VITE_GITLAB_CLIENT_ID` set in the site's environment,
and a `/* -> /index.html 200` rewrite. The rewrite is not cosmetic: without it
`/auth/callback` and every day deep link return 404 from the CDN. A strict
Content-Security-Policy is served from `netlify.toml`, allowing connections only
to the GitLab origin, which narrows what an injected script could do with the
in-memory token.

### 12. Version pins, and one tool that is not the newest

Three pins exist because the newest release of one package is incompatible with
the newest release of another. Each is recorded where it is made:

- **TypeScript 5.9.3**, not 7.x: `typescript-eslint@8` declares
  `typescript >=4.8.4 <6.1.0`, and no published version — including its canary —
  supports 6 or 7. Type-aware linting is load-bearing here, so TypeScript follows
  it.
- **ESLint 9.39.5**, not 10.x: `eslint-plugin-react` and `eslint-plugin-jsx-a11y`
  cap at ESLint 9. Accessibility and React correctness rules are load-bearing, so
  ESLint follows them.
- **eslint-plugin-unicorn 65**, the last release that accepts ESLint 9.

Everything else runs on its current release.

### 13. Bun, with two exceptions

Bun is the package manager, script runner and runtime. Two tools run on Node
because they break under Bun, and both are marked in `package.json`: Stryker
(its plugin loader cannot resolve its own test-runner plugins) and the Playwright
run. `jsdom` was replaced by `happy-dom`, which works under Bun and cut the test
environment setup from 14.3 s to 1.7 s.

### 14. Performance is measured, not asserted

`size-limit` fails the build above 180 kB gzip for the initial chunk. Web Vitals
are asserted inside the Playwright suite. Lighthouse CI is deliberately absent:
`@lhci/cli` reaches `puppeteer` → `extract-zip`, whose high-severity advisory has
no fixed version, and this project's `bun audit` gate permits zero
vulnerabilities at any severity. A gate that would have to be silenced is not a
gate.

### 15. The day feed skips work without a virtualiser

Rows in the day feed carry `content-visibility: auto` with a reserved intrinsic
size. The browser then skips layout and paint for the rows off screen while
keeping their space, which is the work a virtualiser saves — without one.

A virtualiser was the plan and was dropped on contact with the requirement. Rows
here expand into their work items, so their height changes; a measured list whose
items change height is exactly where a virtualiser scrolls the reader somewhere
they did not ask to be, and UI-3 requires the list to extend without jumping.
`@tanstack/react-virtual` was installed, tried and removed.

The feed extends both ways: an `IntersectionObserver` sentinel asks for the next
page as the reader approaches the end, and an explicit control does the same for
anyone who is not scrolling — an observer never fires for someone tabbing through
the page, and "scroll further" is not an instruction a keyboard reader can follow.

Chart colours live in `src/app/charts.css`, apart from the interface tokens,
because they answer to a different rule: an interface colour has to look right, a
chart colour has to be readable. Every value there was checked with a palette
validator against this app's own card surfaces, in both themes — the ordinal ramp
for the month heatmap is one hue with monotone lightness and a light end that
still clears the surface, and the categorical set for the project split keeps its
adjacent pairs separable under colour-vision deficiency.

### 16. Tests follow the spec, at two levels

Each capability's scenarios become Gherkin, at whichever level can actually
observe the behaviour: business rules in `features/domain/` run against the pure
model with no browser; user flows in `features/acceptance/` run in a real browser
through `playwright-bdd`, with `axe-core` assertions on every screen in both
themes. Component behaviour is covered by Testing Library with GitLab's GraphQL
endpoint intercepted by MSW using fixtures shaped from the real response captured
during research. Every scenario carries a `# Spec: <capability> / <id>` comment,
so a requirement can be traced to the test that proves it.

The acceptance suite drives the OAuth flow against a stubbed authorize endpoint,
so it needs no real credentials and can run in CI.

## Risks / Trade-offs

- **The access token is reachable by injected script.** → Read-only scope, so the
  worst case is disclosure of data the reader can already see; token in memory
  only, so it does not survive the tab; rotating refresh token; a strict CSP that
  allows connections only to GitLab; no `dangerouslySetInnerHTML` anywhere; and a
  dependency audit gate that permits zero vulnerabilities, because a compromised
  dependency is the realistic path to injection in an app with no user-generated
  content.
- **The whole design rests on GitLab's permissive CORS.** → It is verified, not
  assumed, and `read_api` is a documented public API surface. If GitLab ever
  restricts it, the recovery is a single Netlify function proxying
  `/api/graphql`; the gateway port means only the adapter changes.
- **The refresh token sits in `localStorage`.** → Rotated on every use, so a stale
  copy is worthless; sign-out revokes it at GitLab. The alternative, a redirect on
  every cold start, trades a real latency cost for a marginal gain.
- **A rejected renewal could log the reader out mid-session.** → Treated as a
  first-class path: the session ends cleanly, the store is cleared, and the reader
  is returned to sign-in with their destination remembered.
- **One request per page could mean many requests over a long history.** → A page
  of 100 covers roughly a month for a real user, pages are fetched only when
  scrolled to, and results are cached for 24 hours.
- **`spentAt` is an instant, not a date.** → Bucketing happens in the configured
  time zone, once, in `toIsoDate`; the provider is never asked for a period,
  because it would filter one in UTC. Time-zone boundaries are a named group of
  scenarios in the model's Gherkin features.
- **Recharts is heavy relative to the rest of the bundle.** → Loaded lazily and
  held to the `size-limit` budget, which fails the build rather than warning.
- **Bun's ecosystem has rough edges under Windows.** → Two known exceptions are
  pinned to Node and documented; the CI image runs both runtimes.
- **A deploy with a missing environment variable or an unregistered redirect URI
  fails only at sign-in.** → Both are steps in the release checklist, and the app
  reports a missing client id as a configuration error rather than a failed login.

## Migration Plan

There is no data to migrate: the app holds no state a person would lose, and the
report is always derived from GitLab.

1. The v1 implementation was removed on this branch; it remains on `main` at
   `be7a488` and can be run for comparison.
2. Each user creates a non-confidential OAuth application in their own GitLab
   settings with the `read_api` scope and both redirect URIs. Self-service, no
   administrator.
3. Set `VITE_GITLAB_CLIENT_ID` in the Netlify site and add the deploy origin's
   `/auth/callback` to the OAuth application.
4. Verify on a deploy preview before promoting: sign in against the preview
   origin, and confirm the last-30-days total matches the value captured during
   research for the same account.

Rollback is redeploying the previous Netlify build; nothing external changes
state, so there is nothing to undo beyond that.
