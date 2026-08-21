# GitLab Hours Dashboard

A personal dashboard of the hours you logged in GitLab, built from the time
tracking (`/spend`) on issues and merge requests. You sign in with your own
GitLab account — there is no Personal Access Token to paste anywhere.

It is a static single-page app: the browser talks to GitLab's GraphQL API
directly, so there is no backend and no database to run or pay for.

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
2. Name it anything, for example `Hours Dashboard`.
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
bun run verify          # format, lint, types, architecture, dead code, audit
bun run test            # unit and component tests
bun run test:e2e        # Gherkin acceptance suite in a real browser
bun run build           # production build into dist/
```

`AGENTS.md` lists every command and what each gate enforces.

## Security

`bun audit` must report **zero vulnerabilities at any severity**. It is part of
`bun run verify`, runs on every push through a git hook, and blocks CI. A
dependency that carries an unfixable advisory does not enter this project; if one
appears later, the dependency is replaced or removed rather than ignored.

Two consequences of that policy worth knowing about:

- **Lighthouse CI is not used.** `@lhci/cli` pulls in `puppeteer` →
  `extract-zip`, which has a high-severity advisory with no fixed version, plus
  vulnerable `tmp` and `uuid`. Performance is guarded instead by the
  `size-limit` bundle budget and by Web Vitals measured in the Playwright suite.
- **`qs` is pinned** through `overrides` to a patched version, because
  `@stryker-mutator/core` reaches an older one transitively.

The OAuth access token is held in memory only and is never written to storage.
The refresh token is kept in `localStorage` and rotates on every use, so the app
stays signed in across visits with the smallest blast radius we can offer a
browser-only client. The token's scope is `read_api`: read-only.

## Deployment

The app deploys to Netlify as static files. Set `VITE_GITLAB_CLIENT_ID` in the
Netlify site's environment variables, and remember to add the deployed origin's
`/auth/callback` URL to the GitLab OAuth application's redirect URIs.
