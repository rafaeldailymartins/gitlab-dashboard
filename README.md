# GitLab Dashboard

A personal dashboard of the hours you logged in GitLab, built from the time
tracking (`/spend`) on issues and merge requests. You sign in with your own
GitLab account — there is no Personal Access Token to paste anywhere.

It is a static single-page app: the browser talks to GitLab's GraphQL API
directly, so there is no backend and no database to run or pay for.

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

**Settings** — hours per weekday, the time zone that decides when a day starts,
the language, and the colour scheme. All of it on your device only.

## How the data flows

```
Browser (static files on a CDN)
  ├── PKCE authorize   ──> gitlab.com/oauth/authorize
  ├── token / refresh  ──> gitlab.com/oauth/token      (no client secret)
  └── hours            ──> gitlab.com/api/graphql      (Bearer, CORS allows it)

No server. No database. One public setting: VITE_GITLAB_CLIENT_ID
```

One query, and it carries no period: `currentUser.timelogs` sorted newest first,
a hundred entries at a time. That is deliberate and was measured — GitLab
truncates `startDate` and `endDate` to **UTC calendar dates**, so a period asked
of it is a window of UTC days, which is not the window you see when your day
starts at midnight in São Paulo or Tokyo. Reading newest first means today, this
week and this month all arrive in the first response, and every period is cut
from the loaded entries where your time zone is known. Older history extends the
same cache entry as you scroll.

That cache is persisted to IndexedDB, so a return visit paints the last figures
before any request is issued — and within five minutes it makes no request at
all. Signing out clears it, so one person's hours never greet the next one on a
shared device.

## Stack

- React 19 + TypeScript, built by Vite
- TanStack Router (SPA, file-based routes) and TanStack Query
- Tailwind CSS v4 with shadcn/ui components on Base UI
- Paraglide JS for i18n (English and Brazilian Portuguese)
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
5. Scopes: tick **`read_api`** only. The dashboard never writes to GitLab.
6. Save, and copy the **Application ID**.

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
bun run test            # unit, component and Gherkin domain tests
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
The scope is `read_api`: read-only, and the authorize request is asserted to ask
for nothing more.

The production bundle ships a strict Content-Security-Policy: `default-src
'none'`, `connect-src` limited to your GitLab origin, and `script-src 'self'`
plus the hash of the one inline script that sets the theme before the first
paint. The hash is only knowable after the build, so `bun run csp` writes the
policy into `dist/_headers`; `netlify.toml` deliberately does not carry one,
because a policy written there would need `'unsafe-inline'`.

## Deployment

The app deploys to Netlify as static files. Set `VITE_GITLAB_CLIENT_ID` in the
Netlify site's environment variables, and add the deployed origin's
`/auth/callback` URL to the GitLab OAuth application's redirect URIs — those two
are the ones that fail at sign-in rather than at build time.
`docs/qa/release-checklist.md` is the full pass.
