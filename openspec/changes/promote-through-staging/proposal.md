# Every change reaches production through staging

## Why

The only way to see this app working on Netlify before it is live is a deploy
preview, and a preview cannot sign in: every one has its own origin, GitLab
matches redirect URIs exactly and accepts no wildcard, so each would need its own
entry on the OAuth application. The parts of this app that only exist on the
platform — the functions, Netlify Blobs, the CDN in front of them — are exactly
where two defects hid until production (the CDN consuming `If-Match`, and the
`openid` scope ticked in the wrong order), and people other than the author now
read their hours on it.

There is also no record of what was released when. `main` is deployed on every
merge, no version is tagged, and the only history of a release is a list of
merge commits.

## What changes

- **A `staging` branch between the work and production.** Feature branches open
  pull requests into `staging`; `staging` is promoted by a pull request into
  `main`. A `hotfix/*` branch may go straight into `main`, and the fix is then
  brought back into `staging` by a pull request from `main` — the only time
  `main` flows into `staging`.
- **`staging` is deployed at one address that never changes**,
  `https://staging--gitlabdashboard.netlify.app`, so its callback is registered
  on the OAuth application once and sign-in works there.
- **Homologation does not touch production's documents.** Every deploy that is
  not production — the `staging` branch deploy and every deploy preview — keeps
  readers' teams and schedules in a store of its own, `readers-staging`.
  Production's store keeps its name, `readers`, because renaming it would empty
  every reader's teams. Homologation starts empty.
- **A pull request into `main` from anything but `staging` or `hotfix/*` fails a
  check**, so the flow is enforced rather than remembered.
- **Commit messages are checked in CI**, not only by a local hook, because the
  release notes are built from them.
- **Every merge into `main` is a release.** The next version is computed from the
  Conventional Commits since the last tag, tagged, and published as a GitHub
  Release with notes generated from those commits. The current `main` is tagged
  `v2.0.0` as the baseline. There is no release pull request, no `CHANGELOG.md`,
  and no bot commit on `main`; the unused `version` field leaves `package.json`,
  so the tags are the one place a version is written down.
- **Promotion is a pull request the author opens** when `staging` has been
  validated, and its description is the part of the release checklist that only
  a real deploy can answer.
- **`CONTRIBUTING.md` documents the flow**, and `AGENTS.md`, both READMEs and the
  release checklist point to it.

## Capabilities

### New Capabilities

- `delivery`: how a change reaches readers — through a homologation environment
  whose documents are its own, by the only paths into production, and as a
  version computed from its commits.

### Modified Capabilities

None. The teams and the schedule keep every requirement they have; what changes
is which store a given deploy files them under, which is a property of the
deploy rather than of either document.

## Impact

- **Code:** `netlify/lib/blob-store.mts` names its store from the deploy context
  the function is called with; `document-endpoint.mts` passes that context
  through; both are proved in the `functions` Vitest project.
- **CI:** `ci.yml` also runs on pushes to `staging`, and gains a branch-policy
  check, a commitlint check and a release job on `main`. The release tool adds
  nothing to `bun.lock`, so the zero-vulnerability `bun audit` gate is untouched.
- **Repository settings:** a ruleset for `staging` matching `main`'s; on `main`,
  "require branches to be up to date" is turned off and the new checks required.
- **Netlify:** branch deploys for `staging` only; `VITE_GITLAB_CLIENT_ID`
  available to the branch-deploy context.
- **GitLab:** one redirect URI added to the OAuth application.
- **Docs:** `CONTRIBUTING.md` (new), `docs/qa/release-pr.md` (new),
  `docs/qa/release-checklist.md`, `AGENTS.md`, `README.md`, `README.pt-BR.md`,
  `openspec/config.yaml`.
