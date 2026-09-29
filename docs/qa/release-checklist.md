# Release checklist

Three of the items below are the ones that actually break a deploy. None of them
fails the build; all three stop somebody signing in. The first two are invisible
locally, because they are about an environment and a URL that only exist once
the app is deployed. The third is not — it takes local development down with it,
which is the mercy in it.

- **`VITE_GITLAB_CLIENT_ID` missing from the Netlify environment.** The build
  succeeds; the app shows the "this build has no GitLab application" screen. It
  is a build-time variable, so setting it afterwards needs a rebuild, not a
  redeploy of the same artifact.
- **The deploy URL missing from the OAuth application's redirect URIs.** The
  build succeeds and the app loads; GitLab refuses the round trip. Every
  deploy-preview URL is a different origin and GitLab matches exactly, which is
  why the checks that need a session happen on staging, whose address never
  changes — `CONTRIBUTING.md` has the environments.
- **`openid` not ticked on the OAuth application before the bundle that asks for
  it is deployed.** The build succeeds and the app loads; every new sign-in
  fails with `invalid_scope`, for everybody, including readers who never open
  the teams dialog. GitLab validates the requested scope against the
  application's own, and `src/entities/sessions/api/gitlab-oauth.ts` asks for
  `read_api openid`. The application is updated first and the bundle deployed
  after; the reverse order is an outage.

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
- [ ] Scopes are `read_api` and `openid`, and nothing else. The app never
      writes; `openid` grants no authority over anything, and buys one thing —
      an assertion both document endpoints can check against GitLab's published
      keys, so neither has to be handed a credential that reads all of GitLab in
      order to learn a user id.
- [ ] **`openid` is ticked before the bundle that asks for it is deployed.** A
      reader whose session predates the scope is not signed out: their refresh
      token renews without an `id_token`, everything but their teams keeps
      working, and the teams surface alone shows an inline notice asking them to
      sign in again.
- [ ] Redirect URIs include every origin that will complete a sign-in:
- [ ] `http://localhost:3000/auth/callback`, for development
- [ ] the production Netlify URL plus `/auth/callback`
- [ ] `https://staging--gitlabdashboard.netlify.app/auth/callback`, for
      homologation. Deploy previews are not registered: each has its own origin,
      so they are for the interface and staging is for a session
- [ ] The Application ID is in Netlify under **Site configuration → Environment
      variables** as `VITE_GITLAB_CLIENT_ID`, for the production, branch-deploy
      and deploy-preview contexts. Staging is a branch deploy, so without that
      context it builds the "no GitLab application" screen.

`VITE_GITLAB_BASE_URL` is optional and defaults to `https://gitlab.com`. Set it
only for a self-managed instance.

## The document endpoints

`netlify/functions/{teams,preferences}.mts` are the pieces of this app that do
not run in
the browser. It adds no new setting — it reads the same two variables the bundle
is built with — which is exactly where it can go wrong, because they now have to
mean the same thing in two places.

- [ ] `VITE_GITLAB_CLIENT_ID` — and `VITE_GITLAB_BASE_URL` if it is set at all
      — is in scope for **Functions**, not only for Builds. Netlify scopes each
      environment variable, and one scoped to builds alone leaves the function
      answering `503 identity-unavailable` while the app around it works
      perfectly.
- [ ] `VITE_GITLAB_CLIENT_ID` at function time is the same application the
      bundle signs in with. It is verified as the assertion's audience, so a
      second application id here refuses every teams request while every other
      screen keeps working.
- [ ] `VITE_GITLAB_BASE_URL` at function time is the same instance. It is the
      issuer, and the key set is discovered from it and required to be on its
      own origin. Unset here but set at build time means the function is
      checking assertions against `https://gitlab.com` and refusing all of them.
- [ ] A usage notification is set on the Netlify account. The Free plan has no
      platform rate limiting — that is a Traffic Rules feature on the paid
      tiers — and its function-invocation cap pauses every site on the account
      when it is reached. The endpoint's own control is ordering: it parses,
      verifies the signature, and only then touches the store, so an
      unauthenticated flood never reaches Netlify Blobs. Invocations are still
      metered, and the notification is what tells you they are climbing.

## On staging

`https://staging--gitlabdashboard.netlify.app`, after the change has merged into
`staging` and before it is promoted. `docs/qa/release-pr.md` is these steps as
the promotion pull request's body.

Staging keeps its teams and schedules in `readers-staging`, which no production
deploy reads, so everything below can be tried for real without touching a
reader's documents (DELIVERY-1).

- [ ] The app loads and asks for a sign-in.
- [ ] Sign in end to end against real GitLab. If this fails with a redirect-URI
      error, the staging callback is missing from the application.
- [ ] Today's hours match GitLab's own report.
- [ ] Hard-refresh `/days/<a date>`. The SPA fallback serves it rather than a 404.
- [ ] Open the teams dialog and save a team. The function is deployed and answers: the
      team survives a reload, and `/.netlify/functions/teams` returns a document
      rather than a 404 or a `503 identity-unavailable`. The acceptance suite
      cannot cover this — it serves a static `dist/` with `vite preview`, which
      runs no function — so a deploy is the first place the endpoint exists at
      all.
- [ ] **That team is not listed in production.** Homologation files it under
      `readers-staging`; seeing it in production means a deploy took the wrong
      store, and the next staging experiment would land in readers' documents.
- [ ] **With the network panel open, read the `PUT` that save sent.** It carries
      `x-document-version`, and the answer is a `200` carrying
      `x-document-version` back — not a `428`, and no `ETag` at all. A 428 means
      the header did not reach the function, which is a fact
      about the path between the browser and it and not about this code. It
      happened: the version used to travel as `If-Match` and `If-None-Match: *`,
      Netlify's CDN consumes the `If-*` headers for its own conditional
      requests, and every write on the deployed site was refused while all three
      local instruments stayed green — the `functions` project calls the handler
      directly, the acceptance suite route-stubs the endpoint, and `bun run dev`
      is a Vite middleware. **Read the request, not only the outcome**: a save
      that appears to work is not evidence, because a first write against an
      empty store and a refused write look the same to a reader with no teams.
- [ ] **Save the same team a second time, and read that `PUT` too.** Every
      first write goes out as `*`, so a store that has only ever been written
      once proves nothing about the version a write names afterwards. The
      version it sends must be exactly the one the previous answer carried, and
      the answer must be a `200`, not a `409`. It was not, for a while: the
      version came back as `ETag`, which Netlify's CDN rewrites when it
      compresses a response (`"8c97…208"` arrived as `"8c97…208-df"`), so every
      save after a reader's first was refused as "changed somewhere else" —
      found in production, by the second save anybody ever made there.
- [ ] Change a weekday target in `/settings`. The same holds for
      `/.netlify/functions/preferences`, which is a second function and so a
      second thing that can fail to deploy. Clear this device's `preferences`
      key, reload, and confirm the value comes back — which is the whole of what
      a second device is. Then change it once more. Read both `PUT`s, for the
      same reasons and with more
      care: this one **fails quietly**. A refused settings write costs no dialog
      and no error, only the one line saying the settings are not reaching your
      other devices — which is easy to have never looked at.
- [ ] Work the manual pass in `regression-checklist.md`.

### The checks no suite can make

Each needs a real account and a deployed function, so they live here rather than
in a test file. `docs/qa/test-plan.md` delegates them here by name.

- [ ] **The request arrives as it was sent.** Everything between the browser and
      the function — the CDN, the edge, any redirect — is absent from every
      suite this repository runs, and it is not a passive pipe: it reads headers
      and it acts on some of them. So the two writes above are checked at the
      request rather than at the result. Nothing local can stand in for this,
      which is why it is written as a step and not as a test: the instruments
      that could see it are a deploy and a network panel.

- [ ] **A row total is the person's whole reach.** Pick one teammate and one
      month, leave the group filter empty, and check their row total against
      what GitLab reports for them — including at least one project you cannot
      open and at least one work item with no project at all. No fixture can
      prove this: a stub answers with whatever it was written to answer, and the
      claim is precisely that the answer is not scoped. If the figures are short,
      the filter is being sent when it should not be.
- [ ] **The same reader, narrowed to a group they can read fully, is short by
      nothing.** Set the filter to a group where you can open every issue. Every
      row should report no hidden hours. A shortfall here means the aggregate and
      the nodes disagree about which entries they cover, which is the one failure
      the instrument itself cannot detect.
- [ ] **A second account cannot reach the first's teams, or their settings.**
      Sign in as a different GitLab account, in a different browser profile,
      against the deployed site. It gets its own empty team list and its own
      default schedule. Then, still as that account, call
      `/.netlify/functions/teams` and `/.netlify/functions/preferences` by hand
      with its own bearer assertion and confirm each document it receives is its
      own. Both keys are derived server-side from the verified subject and from
      nothing the request carried — the second one by appending a constant the
      function module chooses — so no browser can ask for somebody else's, which
      is exactly why no browser test can prove it either.

## After promoting to production

- [ ] **The deploy Netlify is serving is this merge's.** A deploy that built is
      not a deploy that went live: publishing an earlier deploy by hand locks
      auto-publishing, and every later deploy then builds `ready` and is never
      published — three did, one after another, with nothing on the site saying
      so. `Deploys` shows the published one; if it is not the merge's commit,
      unlock auto-publishing and publish it.
- [ ] Sign in on the production URL.
- [ ] **The teams listed are the ones production had, and a save works.** The
      function names its store from the deploy context the platform hands it,
      and it refuses rather than guesses when that is not a value it knows. A
      refusal answers `503 store-unavailable`, and the teams surface says it
      cannot reach them: publish the previous deploy, and read what
      `context.deploy.context` was.
- [ ] Reload and confirm the figures paint before any request — the cache is
      per-origin, so production has its own and this is the first time it is
      exercised there.
- [ ] Sign out, and confirm IndexedDB and the refresh token are gone.
- [ ] The release for the merge is on the releases page, with its version and
      its notes. A merge whose checks failed publishes none. A merge with no CI
      run at all is a push GitHub never delivered —
      `CONTRIBUTING.md` § When a merge does not start anything.

## If it has to be rolled back

A rollback is still Netlify's "publish deploy" on the previous one, and it
restores the function along with the bundle. Four things now survive it, and
each is a different kind of risk.

**The rosters.** Teams live in a site-wide Netlify Blobs store, not a
deploy-scoped one, precisely so a team does not die with the deploy that wrote
it. A rollback leaves every reader's teams exactly where they are — which is the
behaviour you want, and also the thing that makes the next two paragraphs
matter.

**The store name and the key are part of the address too, and they do not
follow the code either.** `blob-store.mts` names the store and each document
module names its own suffix, so the documents a rolled-back function looks for
are the ones that release spelled. Rolling back across the release that renamed
the store from `teams` to `readers` and gave the teams document the suffix
`/teams` points the restored function at store `teams`, key `v1/<sub>` — which
holds nothing, and says so exactly the way an empty region does: no error, no
null anybody sees, an empty roster and default settings for everybody. For that
release specifically there is nothing to recover, because the old store was
emptied deliberately rather than migrated; nobody had saved anything worth
keeping yet. **That option expires the moment somebody does.** Treat a later
change to either the store name or a suffix as the region paragraph below
treats the region: copy first.

**Which store a deploy uses follows the code, and that cuts one way.** Since
`store-name.mts`, production files documents under `readers` and every other
deploy under `readers-staging`. Publishing an earlier production deploy touches
production alone. But a bundle from before that change names `readers` on
every deploy — so reverting it on `staging`, or a deploy preview of a branch cut
before it, is homologation reading and writing readers' real documents. Turn
branch deploys off for `staging` before such a revert reaches it. The other
direction is harmless: what homologation wrote stays in `readers-staging`,
unread.

**The region is part of the address, and it does not follow the code.**
`blob-store.mts` pins `us-east-2`, and a site-wide store held anywhere else is
invisible to every tool that does not name it: the dashboard's Blobs browser
shows nothing, and `netlify blobs:list` answers an empty list rather than an
error. It was `us-east-1` once and cost an afternoon of looking at an empty
dashboard while the data was fine. **Changing that constant moves nothing** — a
deploy would simply start reading an empty region, and a missing key is
indistinguishable from a reader who has never saved, so nothing would report it.
Any change to it needs the documents copied first:

```bash
netlify blobs:get readers "v1/<sub>/teams" --region <old> -O teams.json
netlify blobs:set readers "v1/<sub>/teams" --input teams.json --region <new>
```

and the same for `v1/<sub>/preferences`. Compare the etags across the two
regions afterwards: equal etags mean equal bytes.

**The stored documents' shapes do migrate, and a rollback loses what it cannot
read.** `netlify/lib/teams-document.mts` and `netlify/lib/preferences-document.mts`
each pin `version` to a literal, so a document written by a later shape is
refused outright rather than half-understood, and the key carries `v1/` as well.
The restored function does not report that: `storedOf` answers an unreadable
document with the empty one, which is right for a truncated write and is exactly
what makes a rollback quiet. A reader's teams come back as none, and their
settings come back as "the store has never heard of you" — so the first device
to reconnect republishes whatever it happens to hold, over everybody else's, and
nothing on any screen says a thing. Any change to either schema needs its own
rollback answer before it ships; this section is not it.

**The OAuth scope is asymmetric.** A rolled-back bundle asking for `read_api`
against an application that still has `openid` ticked is fine — GitLab only
requires the request to be a subset of what the application carries. The reverse
is an outage. So a rollback never unticks `openid`, and if the scope has to come
off the application, the bundle that asks for it comes off first.

On the reader's device nothing changed: a refresh token and a query cache, both
of which a newer bundle reads and an older one ignores. The team report is not
written there at all — every query behind it carries `persist: false`, because a
month of somebody else's hours must not outlive the visit on a shared machine.
