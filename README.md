# GitLab Dashboard

A personal dashboard of the hours you logged in GitLab, built from the time
tracking (`/spend`) on issues and merge requests. You sign in with your own
GitLab account — there is no Personal Access Token to paste anywhere.

Almost all of it is a static single-page app: the browser talks to GitLab's
GraphQL API directly. The exceptions are the teams you define — a team is a list
of people you keep — and your working schedule, which two serverless functions
on this app's own origin hold, so a team built on the laptop is there on the
phone and the hours you count a day as are the same on both. No hours pass
through them, and nothing else needs a server.

## What it shows

**The dashboard** — hours for today, this week and this month, each against the
target you set for those weekdays; a bar per day of the current week with the
target drawn on the same scale, so a bar reaching the line means the day was
met; and below that your whole history, newest day first, each day opening into
the issues and merge requests it went into.

**A day** (`/days/2026-08-21`) — one day on its own address, so you can link to
it or reload it, with every work item and its hours.

**Insights** — a square per day of the month, where a working day with nothing
logged is drawn differently from a day with time and from the days outside the
month; hours split by project; and a sortable table of what took the time.

**A team's month** (`/team`) — the people on one of your teams down the side,
the days of that month across the top (or its weeks), and hours in the cells,
each with a bar measured against the working schedule you set in Settings; a
weekday you expect no hours on is shaded. Everybody you put on the team keeps a
row, including somebody who logged nothing: you chose them, so an empty row is
the answer you came for.
Left alone, the figures cover every hour GitLab will show you for those people
wherever they logged it, personal projects included. A group filter — empty by
default — narrows them to one group and its subgroups, and the caption and the
empty cells both say which of the two you are reading.

**Teams** — the lists themselves, edited in a dialog over whatever you were
reading rather than on a screen of their own: you notice a team is wrong while
reading its month, and there is nothing in that list worth sending anybody, so
there is nothing to navigate to. Name a GitLab group and the team is made from
it in one click, carrying everyone who logged time there in the last 30 days;
after that you take people off, search GitLab for anybody by name, or add
another group's people in. It is whoever logged, not whoever has access: on one
real squad, membership offered seventeen names of which eleven had no hours at
all, and missed two people who had logged. Reached from the report's toolbar and
from Settings, never from a fifth link in the navigation.

**Settings** — hours per weekday, the time zone that decides when a day starts,
the language, and the colour scheme. The first two follow you: they are facts
about you rather than about a machine, and since the team table measures its bars
against your daily target, a laptop and a phone disagreeing about it would draw
the same month two different ways. They are kept beside your teams, under a key
derived from who the store verified you are. The language and the colour scheme
stay on the device — the theme is applied before the first paint, which nothing
fetched over the network can be. Plus the way through to your teams.

## How the data flows

```
Browser (static files on a CDN)
  ├── PKCE authorize   ──> gitlab.com/oauth/authorize
  ├── token / refresh  ──> gitlab.com/oauth/token      (no client secret)
  ├── hours            ──> gitlab.com/api/graphql      (Bearer, CORS allows it)
  ├── teams            ──> /.netlify/functions/teams        (id_token, same origin)
  └── settings         ──> /.netlify/functions/preferences  (id_token, same origin)

Two functions over Netlify Blobs, through one handler: lists of people and
your own schedule, never hours.
One public setting: VITE_GITLAB_CLIENT_ID
```

Your own hours are one query, and it carries no period: `currentUser.timelogs`
sorted newest first, a hundred entries at a time. That is deliberate and was
measured — GitLab truncates `startDate` and `endDate` to **UTC calendar dates**,
so a period asked of it is a window of UTC days, which is not the window you see
when your day starts at midnight in São Paulo or Tokyo. Reading newest first
means today, this week and this month all arrive in the first response, and
every period is cut from the loaded entries where your time zone is known. Older
history extends the same cache entry as you scroll.

That cache is persisted to IndexedDB, so a return visit paints the last figures
before any request is issued — and within five minutes it makes no request at
all. Signing out clears it, so one person's hours never greet the next one on a
shared device.

A team's month is asked differently, and on purpose: `startTime` and `endTime`,
given together, reach the query untouched, so a bounded month is askable there.
One request carries the whole team, its per-person totals included, because
GitLab's complexity budget counts fields in the document rather than rows in the
answer — measured, 26 points of 250 for one person and 29 for sixteen. Those
totals are also what the report checks its own figures against: GitLab computes
them over the whole relation before removing the entries you may not read, so
the difference between the two is the only instrument that can see an hour being
withheld, and it is per person, so the row says it is short rather than the
footer saying the team is. None of that answer reaches the device — every query
on the screen is marked not to be persisted, because those hours and that roster
belong to people other than you.

## Stack

- React 19 + TypeScript, built by Vite
- TanStack Router (SPA, file-based routes) and TanStack Query
- Tailwind CSS v4 with shadcn/ui components on Base UI
- Paraglide JS for i18n (English and Brazilian Portuguese)
- Two Netlify Functions over Netlify Blobs (`@netlify/blobs`), one handler
  behind them, for the teams and the schedule — with `jose` verifying the
  caller's GitLab identity token against GitLab's own keys
- Bun as package manager, script runner and runtime
- Feature-Sliced Design with a Clean Architecture core — see `AGENTS.md`

## Prerequisites

- [Bun](https://bun.sh) 1.4 or newer
- Node.js 24 or newer (two tools still run on Node; see `AGENTS.md`)

## Setup

### 1. Create a GitLab OAuth application

This is a one-time, self-service step in your own GitLab account. No
administrator is involved.

1. Open **GitLab → User Settings → Applications → Add new application**.
2. Name it anything, for example `GitLab Dashboard`.
3. Redirect URI — add both, one per line:
   ```
   http://localhost:3000/auth/callback
   https://<your-site>.netlify.app/auth/callback
   ```
4. **Leave "Confidential" unchecked.** The app is a public OAuth client and uses
   PKCE, so it has no client secret to protect.
5. Scopes: tick **`read_api`** and **`openid`**, and nothing else. The dashboard
   never writes to GitLab, and `openid` grants no authority over data at all —
   it asks GitLab to state who you are, in a short-lived signed token the teams
   endpoint checks against GitLab's published keys.
6. Save, and copy the **Application ID**.

**Tick `openid` before you deploy a bundle that asks for it.** GitLab validates
an authorize request against the application's own scopes, so the other order
fails every sign-in with `invalid_scope`. Going the right way round costs
nothing: a session granted before the scope was added keeps working, because a
renewal carries the original scopes forward. It shows an inline notice asking
you to sign in again on the teams surface, and a quiet line on the settings
screen saying your schedule is not reaching your other devices; both surfaces
fall back to what this device itself holds. You are never signed out.

### 2. Configure the app

```bash
cp .env.example .env
```

Put the Application ID in `VITE_GITLAB_CLIENT_ID`. This value is public: it ships
inside the client bundle, which is exactly how a PKCE public client works. There
is no secret in this repository.

### 3. Run it

```bash
bun install
bun run dev
```

Open http://localhost:3000 and sign in with GitLab.

## Everyday commands

```bash
bun run verify          # every fast gate: format, lint, ARIA, types,
                        # architecture, traceability, dead code, audit
bun run test            # unit, component, Gherkin domain and endpoint tests
bun run test:coverage   # the same, with the thresholds enforced
bun run test:e2e        # the acceptance suite in three browsers
bun run test:mutation   # mutation testing on the model layer
bun run build           # production build into dist/, plus its CSP
```

`AGENTS.md` lists every command and what each gate enforces. `docs/qa/` holds the
test plan, the manual regression pass, the browser matrix, the screen-reader
procedure, the release checklist and the measured value of every gate.

## Quality gates

Everything below fails a build rather than warning:

| Gate                               | Where                                    |
| ---------------------------------- | ---------------------------------------- |
| 90% coverage, **100% on `model/`** | `bun run test:coverage`                  |
| Mutation score ≥ 85% on `model/`   | `bun run test:mutation`, scheduled in CI |
| Zero dependency vulnerabilities    | `bun audit`                              |
| 180 kB gzip initial bundle         | `size-limit`                             |
| Zero axe violations, both themes   | the acceptance suite                     |
| Layout shift under 0.1             | the acceptance suite                     |
| No sideways scrolling at 375 px    | the acceptance suite                     |
| Every requirement cited by a test  | `bun run arch:trace`                     |

Two linters, on purpose: ESLint for the rules that need type information or
understand React and the test libraries, Biome for the ARIA rules — it is what
caught an `aria-label` on a generic element that `jsx-a11y` and axe both let
through. `docs/qa/quality-metrics.md` has the measurements behind that choice.

## Security

`bun audit` must report **zero vulnerabilities at any severity**. It is part of
`bun run verify`, runs on every push through a git hook, and blocks CI. A
dependency that carries an unfixable advisory does not enter this project; if one
appears later, the dependency is replaced or removed rather than ignored.

Two consequences of that policy worth knowing about:

- **Lighthouse CI is not used.** `@lhci/cli` pulls in `puppeteer` →
  `extract-zip`, which has a high-severity advisory with no fixed version, plus
  vulnerable `tmp` and `uuid`. Performance is guarded instead by the
  `size-limit` bundle budget and by the layout-shift assertion in the acceptance
  suite.
- **`qs` is pinned** through `overrides` to a patched version, because
  `@stryker-mutator/core` reaches an older one transitively.

The OAuth access token is held in memory only and is never written to storage —
there is an acceptance test that reads both storages and asserts it. The refresh
token is kept in `localStorage` and rotates on every use, so the app stays signed
in across visits with the smallest blast radius a browser-only client can offer.
The scope is `read_api openid`: read-only on GitLab's data plus an assertion of
who you are, and the authorize request is asserted to ask for nothing more.

The two endpoints hold one document each per reader. The teams one holds a
roster: the name, username and GitLab id of everybody you put on a team. The
settings one holds your daily targets and your time zone. No hours in either,
and nothing about anybody who is not on a team. Who is calling is established from the
GitLab `id_token`, verified offline against GitLab's published keys with `jose`
— RS256 named in the call rather than taken from the token, the audience checked
against this application's own id, and nothing minted more than 150 seconds ago
accepted, which bounds replay whatever the token claims for its own expiry. The
storage key is `v1/<sub>`, plus a suffix the function module chooses for its own
document, built from that verified subject and from nothing the request carried:
no field in the body, no value in the address, and no identifier in the route at
all — so naming somebody else's teams is not expressible rather than merely
refused. The assertion itself is never stored: it
lives in a closure beside the access token, and it is minted through the same
single renewal a burst of requests already shares. A write must carry the
version it was made against, in `x-document-version` — the etag, or `*` for a
first write — and one carrying neither is refused with `428`, because a `PUT`
with no precondition is a client that never read. A header of this app's own
rather than `If-Match`: the CDN in front of the function consumes the `If-*`
headers for its own conditional requests, so those never arrived.

What that does not do is keep those documents from the host. Netlify Blobs holds
each one as it was written, unencrypted, so whoever can reach the site's blob
store can read which colleagues you grouped together, and what you set a working
day to be. Nothing about anybody's hours is there, and nothing that is not
already a public GitLab profile, but the grouping is yours and the host can see
it.

The endpoint reads no cookie and emits no CORS header at all, which is what
makes it CSRF-exempt rather than CSRF-lucky: a cross-site form cannot set an
`Authorization` header, and a cross-site `fetch` that does triggers a preflight
this will not answer. Those rules are proved by a third Vitest project,
`functions`, which injects an in-memory store and a locally minted key pair —
the acceptance suite serves a static `dist/` through `vite preview`, which runs
no function, so nothing else can prove them.

The production bundle ships a strict Content-Security-Policy: `default-src
'none'`, `connect-src` limited to `'self'` and your GitLab origin, and
`script-src 'self'` plus the hash of the one inline script that sets the theme
before the first paint. Neither endpoint needs an entry of its own: both are on
this origin, which `'self'` already covers. That is the deciding reason the
store is the host's own function rather than a database somewhere else — every
alternative would have widened this line and added a preflight to answer. The
hash is only knowable after the build, so `bun run csp` writes the policy into
`dist/_headers`; `netlify.toml` deliberately does not carry one, because a policy
written there would need `'unsafe-inline'`.

## Deployment

The app deploys to Netlify as static files plus the two functions in
`netlify/functions/`. Set `VITE_GITLAB_CLIENT_ID` in the Netlify site's
environment variables — both functions read the same variable, because the
audience an assertion has to carry is the application id the browser signs in
with, which is why neither of them adds a new setting. Add the deployed
origin's `/auth/callback` URL to the GitLab OAuth application's redirect URIs.
And tick `openid` on that application before the bundle asking for it goes out.
Those three are the ones that fail at sign-in rather than at build time.
`docs/qa/release-checklist.md` is the full pass.
