# Release checklist

Two of the items below are the ones that actually break a deploy, and both fail
in the same place — at sign-in, on somebody else's machine, after everything
looked fine locally:

- **`VITE_GITLAB_CLIENT_ID` missing from the Netlify environment.** The build
  succeeds; the app shows the "this build has no GitLab application" screen. It
  is a build-time variable, so setting it afterwards needs a rebuild, not a
  redeploy of the same artifact.
- **The deploy URL missing from the OAuth application's redirect URIs.** The
  build succeeds and the app loads; GitLab refuses the round trip. Every
  deploy-preview URL is a different origin, so a preview needs its own entry, or
  the check has to happen on the production URL.

## Before merging

- [ ] `bun run verify` — format, lint, ARIA, types, architecture, dead code, type
      coverage, and zero dependency vulnerabilities at any severity.
- [ ] `bun run test:coverage` — thresholds enforced.
- [ ] `bun run test:e2e` — all three browsers.
- [ ] `bun run test:mutation` — the model layer, at or above 85.
- [ ] `bun run build && bun run size` — inside the 180 kB gzip budget.
- [ ] Every new `Scenario` carries a `# Spec: <capability> / <id>` comment, and
      every requirement touched by the change has one.
- [ ] `bunx openspec validate <change> --strict` passes.

## The OAuth application

Owned by the reader, in their own GitLab account, under **User Settings →
Applications**.

- [ ] **Confidential is unchecked.** This is a PKCE public client; a confidential
      application would require a secret the browser cannot hold.
- [ ] Scope is `read_api` and nothing else. The app never writes.
- [ ] Redirect URIs include every origin that will complete a sign-in:
- [ ] `http://localhost:3000/auth/callback`, for development
- [ ] the production Netlify URL plus `/auth/callback`
- [ ] the deploy-preview URL plus `/auth/callback`, if a preview is to be signed
      into
- [ ] The Application ID is in Netlify under **Site configuration → Environment
      variables** as `VITE_GITLAB_CLIENT_ID`, for the contexts that need it
      (production, and deploy previews if they are to work).

`VITE_GITLAB_BASE_URL` is optional and defaults to `https://gitlab.com`. Set it
only for a self-managed instance.

## On the deploy preview

- [ ] The app loads and asks for a sign-in.
- [ ] Sign in end to end against real GitLab. If this fails with a redirect-URI
      error, the preview URL is missing from the application.
- [ ] Today's hours match GitLab's own report.
- [ ] Hard-refresh `/days/<a date>`. The SPA fallback serves it rather than a 404.
- [ ] Work the manual pass in `regression-checklist.md`.

## After promoting to production

- [ ] Sign in on the production URL.
- [ ] Reload and confirm the figures paint before any request — the cache is
      per-origin, so production has its own and this is the first time it is
      exercised there.
- [ ] Sign out, and confirm IndexedDB and the refresh token are gone.

## If it has to be rolled back

The app is a static bundle with no server and no database, so a rollback is
Netlify's "publish deploy" on the previous one. Nothing migrates. The only
persistent state is on the reader's device: a refresh token and a query cache,
both of which a newer bundle reads and an older one ignores. A rollback cannot
corrupt anything.
