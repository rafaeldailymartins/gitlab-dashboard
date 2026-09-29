# Design

See `proposal.md` for why, and `specs/delivery/spec.md` for what must hold.

## Context

- **One store, named in one place.** `netlify/lib/blob-store.mts` pins
  `getStore({ name: 'readers', region: 'us-east-2', consistency: 'strong' })`,
  and `document-endpoint.mts` calls it once per request through an injectable
  `store` option. `config/vite/api-dev.ts` and the `functions` Vitest project
  inject a memory store instead. Every deploy of the site — production and every
  preview — writes to that one store today.
- **The deploy context is not an environment variable at run time.** Netlify
  sets `CONTEXT` during the build only; a function at run time receives `URL`,
  `SITE_NAME` and `SITE_ID` and nothing about which deploy it belongs to. What it
  does receive is the second argument of a v2 function, whose
  `context.deploy.context` names the deploy's context (`production`,
  `deploy-preview`, `branch-deploy`, `dev`). Both functions are v2 already and
  ignore that argument.
- **Netlify builds** `main` for production and deploy previews for pull requests.
  A preview is built for a pull request whose base is the production branch or a
  branch with branch deploys on, so previews keep coming for pull requests into
  `staging` once it has branch deploys.
- **CI** is `ci.yml` (`push` to `main`, `pull_request`), cancelling a run when a
  newer one arrives for the same ref, plus `mutation.yml` on a weekly schedule.
  The `main` ruleset requires a pull request, merge commits only, the checks
  `verify`, `test`, `build` and `e2e`, and branches up to date before merging.
- **commitlint** runs only as a `commit-msg` hook, with `config-conventional`
  and three rules of this repository's own in `commitlint.config.js`.
- **`arch:trace`** reads requirements from `openspec/changes/` as well as
  `openspec/specs/`, so DELIVERY-1..3 fail it until each is cited or listed in
  `UNCITED_BY_DESIGN`.

## Goals / Non-Goals

**Goals:**

- Homologation and production cannot reach each other's documents, and a deploy
  that cannot say which it is reaches neither.
- The flow is enforced by checks the merge button respects, not by memory.
- A release is a consequence of merging into `main`, with nothing typed by hand
  and nothing new in `bun.lock`.

**Non-Goals:**

- Sign-in on deploy previews. They stay useful for the interface; sign-in is
  what `staging` is for.
- Copying production's documents into homologation, or migrating anything.
- An automatic back-merge after a hotfix, or a promotion pull request opened by a
  bot. A pull request created with the workflow's own token starts no workflow,
  so the checks the merge waits for would never run.
- A `CHANGELOG.md`, a version in `package.json`, or any commit a bot makes on
  `main`.
- Mutation testing on `staging`. It keeps running weekly on `main`.

## Decisions

### 1. The store is named from the deploy the function was called on

A pure mapping in `netlify/lib/store-name.mts`:

| `context.deploy.context`                 | store             |
| ---------------------------------------- | ----------------- |
| `production`                             | `readers`         |
| `branch-deploy`, `deploy-preview`, `dev` | `readers-staging` |
| missing, or anything else                | none — refuse     |

`documentEndpoint` becomes `(request, context)`, resolves the name before it
does anything else, and answers the same `503` it gives for a provider it cannot
reach when the mapping has no answer. The `store` option becomes
`(name) => DocumentStore`; `blobDocumentStore(name)` takes the name and keeps
its region and consistency. `config/vite/api-dev.ts` passes a context of `dev`
and keeps injecting its memory store, which ignores the name.

`dev` maps to homologation because the one way it could reach a real store is
`netlify dev` on somebody's machine, and a developer's laptop is precisely where
production's documents must not be written.

**Refusing rather than defaulting** is DELIVERY-1's own argument. Defaulting to
production lets a misread homologation deploy write over readers' documents in
silence. Defaulting to homologation turns a misread production deploy into every
reader's teams disappearing — which the teams surface would report as a store it
cannot reach, but only after somebody looked. A refusal is loud in both
directions, and the release checklist reads production's teams right after the
first deploy (see the migration plan), which is the one place the value can be
wrong.

_Alternatives._ A `READERS_STORE` environment variable set per context in the
Netlify UI: a second place the rule lives, and a missing variable is exactly the
unknown case, now silent. Reading `URL` or the request's host: `URL` is always
the main address, and the host is a value the caller sent, which this handler
does not take anything from.

### 2. The flow is one required check, not a convention

A `branch-policy` job in `pull-request.yml`, a workflow triggered by pull
requests and by nothing else. It was first a job in `ci.yml` guarded by
`if: pull_request`, and that left a _skipped_ `branch-policy` on every commit a
push to `staging` or `main` ran on — which GitHub counts as a passing required
check, so any branch pointed at staging's head met it before its own pull
request had run. In a workflow no push triggers, no push can create one. It
passes unless the
base is `main` and the head is neither `staging` nor `hotfix/*` **of this
repository** — `github.event.pull_request.head.repo.full_name` must equal
`github.repository`, which is what keeps a fork's branch named `staging` out.
Ten lines of shell reading the event's own fields; there is no input from the
branch's contents to parse.

It is required by the `main` ruleset only. On a pull request into `staging` it
passes, so a back-merge from `main` needs nothing special.

### 3. CI runs on `staging` too, and cancels as it does today

`push` gains `staging`. A promotion's head is the head of `staging`, and GitHub
accepts checks already recorded on that commit, so the promotion merges on the
run its head already had. Cancelling a superseded run stays: on `staging` only
the head matters, and on `main` a cancelled run's commits are released by the run
that replaced it (DELIVERY-3 allows one version for two close merges).

### 4. The release is git-cliff plus `gh`, in a job after the checks

A `release` job in `ci.yml`: `needs: [verify, test, build, e2e]`,
`if: github.event_name == 'push' && github.ref == 'refs/heads/main'`,
`permissions: contents: write`, checked out with full history so the tags are
there. It asks git-cliff for the next version and for the notes of the commits
since the last tag, and publishes both with one call to
`gh release create <version> --target <sha> --notes-file <notes>`, which creates
the tag and the release together — so a cancelled run cannot leave a tag with no
release. If the computed version is a tag that already exists, it says so and
stops.

`cliff.toml` at the root holds the rules, and they are the ones DELIVERY-3
states: the conventional-commit parsers, commits grouped by type, merge commits
skipped, `v`-prefixed tags, and `[bump]` with `features_always_bump_minor` and
`breaking_always_bump_major`. There is deliberately **no** `no_increment_regex`:
a promotion of `docs`, `test`, `ci` or `chore` commits is still a patch.

git-cliff is a single binary run by its own action, pinned to a commit SHA, so
it adds nothing to `bun.lock` and nothing for `bun audit` to see — which is
different from hiding a dependency from it: there is no JavaScript dependency
tree at all.

_Alternatives._ **semantic-release** does the same job, but it is a Node tree of
several hundred packages — including a bundled npm in the default plugin set —
and keeping it out of `bun.lock` by running it through `npx` would be dodging
the audit rather than passing it. **release-please** is built around a release
pull request, which the decisions rule out, and that pull request would be
opened by a token that starts no workflow. **GitHub's generated notes** are built
from pull request titles, and every promotion is titled
"release: promote staging"; they also compute no version.

### 5. Commit messages are checked in CI with the config the hook already uses

A `commit-messages` job in `pull-request.yml`, for the reason § 2 gives: full
history, the shared setup, then
`bun commitlint --from <base sha> --to <head sha> --verbose`. It reads
`commitlint.config.js`, so the hook and the check cannot disagree.
`config-conventional` ignores merge commits by default, which is DELIVERY-3's
exemption. Required by both rulesets.

### 6. Repository settings

- **`main`:** add `branch-policy` and `commit-messages` to the required checks;
  turn off "require branches to be up to date before merging". A promotion's
  merge commit exists only on `main` and is never brought back to `staging`, so
  that setting would make every promotion wait for an update of `staging` and a
  second run of the whole suite, over a commit that carries no content.
- **`staging`:** a new ruleset with `main`'s rules (pull request, merge commits
  only, no deletion, no force push) and the checks `verify`, `test`, `build`,
  `e2e` and `commit-messages`.
- **Tags `v*`:** a ruleset that forbids updating and deleting them. The tags are
  the only place a version is written, so they must not move. Creating one stays
  allowed, which is what the release job does.

### 7. Netlify and GitLab

- Branch deploys: "Let me add individual branches", with `staging` alone, so
  `badges` and every feature branch stay undeployed.
- `VITE_GITLAB_CLIENT_ID` available to the branch-deploy context. Both the build
  and the functions read it.
- `https://staging--gitlabdashboard.netlify.app/auth/callback` added to the
  OAuth application's redirect URIs, by the owner of that application.

### 8. Documentation

- **`CONTRIBUTING.md`**: the environments, and which store each one uses; branch
  names by Conventional Commit type; what opens a pull request into which
  branch; hotfixes and the back-merge; merge commits only; how to promote; how a
  version is computed; the commit-message format. It links to the release
  checklist rather than repeating it.
- **`docs/qa/release-pr.md`**: the body of a promotion pull request — the steps
  of the release checklist that only a real deploy can answer, as checkboxes.
- **`docs/qa/release-checklist.md`**: "On the deploy preview" becomes
  "On staging", and gains the two store checks: a team saved on staging is not in
  production, and production still lists the teams it had.
- **`AGENTS.md`**: a pointer to `CONTRIBUTING.md` beside the commit convention —
  an agent opens its pull requests into `staging` too — and an entry under the
  decisions explaining why the store follows the deploy and why an unknown
  deploy is refused.
- **`README.md` and `README.pt-BR.md`**: a short Contributing section, and the
  deployment section names the staging address.
- **`openspec/config.yaml`**: the context names both stores.
- **`scripts/check-traceability.ts`**: DELIVERY-1..3 in `UNCITED_BY_DESIGN`,
  each with the gate that proves it — no browser can see a store's name, a
  branch rule or a tag.

## Risks / Trade-offs

- **Production reports a context other than `production`** → every document
  request there is refused and teams show as unreachable. The mapping is unit
  tested against the documented values; the migration plan reads production's
  teams immediately after the first deploy; Netlify's "publish deploy" on the
  previous deploy is the rollback, and it restores the old behaviour because the
  old bundle names `readers` unconditionally.
- **A hotfix is not brought back** → homologation runs without a fix production
  has. `CONTRIBUTING.md` makes the back-merge the second half of the hotfix
  step. The next promotion does not undo the fix, because a merge never removes
  what the base already has.
- **`staging` and `main` show as diverged** → the promotion merge commits exist
  only on `main`. They carry no content, so they never conflict and never need
  bringing back; GitHub will report `staging` as some commits behind `main`
  forever, and that is expected.
- **Supply chain of the release action** → pinned to a commit SHA rather than a
  tag, with the release job the only one holding `contents: write` besides the
  badge jobs.
- **A commit that fails commitlint is already on `main`** → only commits since
  `v2.0.0` are read, and every one of those arrives through a pull request the
  check has seen.

## Migration Plan

The change is delivered through the flow it introduces.

1. `main` as it stands is released as `v2.0.0`: a tag and a release whose note
   says it is the baseline.
2. `staging` is created from `main` and pushed, with branch deploys still off:
   the bundle on it names `readers` unconditionally, so a deploy of it would be
   homologation writing to production's store — the one thing this change
   exists to prevent.
3. The implementation is a pull request from `feat/promote-through-staging`
   into `staging`, merged when green. Its deploy preview already runs the new
   mapping, against `readers-staging`.
4. Branch deploys are turned on for `staging` alone, the variable's context is
   widened (with the owner's authorisation, through the CLI), and the owner adds
   the staging callback to the GitLab application.
5. On `https://staging--gitlabdashboard.netlify.app`: sign in, save a team, and
   confirm it is not in production — the first time DELIVERY-1 runs on the
   platform, where only `readers-staging` is at stake.
6. The rulesets are applied, now that the new check names exist.
7. The first promotion: a pull request from `staging` into `main` with
   `docs/qa/release-pr.md` as its body. Its merge deploys production and
   publishes `v2.1.0`.
8. On production: the teams that were there before are still listed. If not,
   publish the previous deploy and read the context the function received.

**Rollback:** reverting the store change makes every deploy name `readers`
again; what was written to `readers-staging` stays there, unread. Deleting the
`staging` ruleset and branch and turning branch deploys off returns the
repository to the previous flow; the tags stay, as history.
