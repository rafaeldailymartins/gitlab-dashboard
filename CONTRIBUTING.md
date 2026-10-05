# Contributing

How a change gets from a branch to the people reading their hours. It applies to
every change, including one an agent makes — `AGENTS.md` sends agents here. The
rules below are enforced by checks and rulesets, so a step skipped by accident is
a pull request that cannot merge rather than a surprise in production.

## Environments

| Environment    | Deployed from  | Address                                                        | Store             |
| -------------- | -------------- | -------------------------------------------------------------- | ----------------- |
| Production     | `main`         | https://gitlabdashboard.netlify.app                            | `readers`         |
| Homologation   | `staging`      | https://staging--gitlabdashboard.netlify.app                   | `readers-staging` |
| Deploy preview | a pull request | `https://deploy-preview-<number>--gitlabdashboard.netlify.app` | `readers-staging` |
| Local          | your checkout  | http://localhost:3000 (`bun run dev`)                          | in memory         |

- **The store is where teams and working schedules are kept.** Homologation and
  every preview share one, production has its own, and neither can reach the
  other's. Homologation started empty: your production teams are not there, and
  anything you break there stays there.
- **Sign-in works everywhere except on a deploy preview.** Each preview has its
  own address, and GitLab accepts a sign-in only back to an address registered
  on the OAuth application, exactly. Use a preview for the interface and
  `staging` for anything that needs a session.
- **A local run keeps teams in memory**, so a restart forgets them.
- **Production is a GitHub deployment.** Once Netlify serves a push to `main`,
  `deployments.yml` records it under the `production` environment, which is
  how the repository page shows what is running. A deployment that failed there
  is a Netlify deploy that did not go live; its log is on Netlify. Homologation
  is not recorded: it is behind Netlify's access protection, so a runner cannot
  see what it serves.

## Branches

- **`main`** is production. **`staging`** is homologation. Both are long-lived and
  protected: they change only through pull requests, and neither can be deleted
  or force-pushed.
- **Everything else is short-lived** and named `<type>/<short-description>`, with
  the type taken from the commit convention below: `feat/export-a-month`,
  `fix/week-strip-rounding`, `docs/staging-address`.
- **`hotfix/<short-description>`** is the one kind of branch cut from `main`, for a
  fix production cannot wait for.

## The flow

```
feat/x ──PR──▶ staging ──PR (promotion)──▶ main ──▶ release vX.Y.Z
                  ▲                          │
                  └───────PR (back-merge)────┤
                                             │
hotfix/x ──────────────PR────────────────────┘
```

1. Branch from `staging` and open a pull request **into `staging`**. The checks
   run, and a deploy preview shows the interface.
2. Merge it. `staging` redeploys at its address.
3. Validate the change on staging — sign in, use what changed.
4. When `staging` holds what you want released, **promote it** (below).

A pull request into `main` from anything but `staging` or a `hotfix/*` branch of
this repository fails the `branch-policy` check and cannot be merged.

## Promoting staging

```bash
gh pr create --base main --head staging --title "release: promote staging" --body-file docs/qa/release-pr.md
```

The body is the part of `docs/qa/release-checklist.md` that only a real deploy
can answer, as checkboxes. Work through them on staging, tick them, then merge.
The merge deploys production and publishes a release.

A promotion takes **everything** on `staging`. If something there is not ready,
fix it or revert it on `staging` first — by pull request, like any other change.
If something cannot wait for that, it is a hotfix.

## Hotfixes

```bash
git switch -c hotfix/fix-the-login-loop origin/main
```

1. Open the pull request **into `main`**, and merge it when the checks pass. It
   is released as a patch.
2. **Straight away, bring it back:** a pull request from `main` into `staging`.
   Until that merges, homologation is missing something production has.

## Merging

Merge commits only — the rulesets allow nothing else. Squashing or rebasing the
commits `staging` carries would make the next promotion propose them again.
`staging` shows as a few commits behind `main` for good: those are the
promotions' own merge commits, they carry no content, and nothing needs them
back.

Auto-merge is on, so a pull request can be armed to merge itself the moment its
checks pass:

```bash
gh pr merge <number> --auto --merge
```

The head branch is deleted after the merge. `staging` and `main` never are: the
rulesets forbid deleting them.

## Dependencies

- **Dependabot** opens pull requests into `staging` every Monday, one per group:
  `chore(deps): …` for runtime packages, `chore(deps-dev): …` for tooling and
  `ci(deps): …` for GitHub Actions. They go through the same checks and reach
  production with the next promotion. `.github/dependabot.yml` has the rules.
- **`bun audit` runs every day** on `main` (the `Audit` workflow), because
  advisories are published between pull requests and Dependabot cannot raise
  security updates for Bun. A red run is a new advisory against a locked
  package: fix it on a branch into `staging`, or as a hotfix if it cannot wait.
  The audit is two tiers (`scripts/check-audit.ts`): a production dependency
  may carry no advisory at all, and a tooling one may only when no release
  fixes it and `scripts/audit/accepted.ts` records why it cannot reach a reader.
  An accepted entry fails the run once the advisory is gone, so it is deleted,
  and once its review is ninety days old, so somebody checks it again.
- **GitHub's dependency graph is given `bun.lock`.** It reads only
  `package.json` on its own, which names seventy-odd packages out of the
  thirteen hundred installed, so `dependency-graph.yml` submits the locked tree
  on every push to `staging` and `main`. That is what lets Dependabot alerts
  see a transitive advisory, and what `dependency-review` compares a pull
  request against.
- **OpenSSF Scorecard** scores how the repository is kept, weekly and after
  every release (`scorecard.yml`). Its findings are under Security → Code
  scanning, beside CodeQL's.
- Found a vulnerability in the app itself? `SECURITY.md` says how to report it.

## Checks

Every pull request runs `verify`, `test`, `build`, `e2e`, `commit-messages` and
`dependency-review`; one into `main` also needs `branch-policy`.
`dependency-review` refuses a pull request that adds a package with a known
advisory, or moves one to such a version, at any severity. Run
`bun run verify && bun run test` before you open it — the git hooks run part of
that on every commit and push, and CI runs all of it. CodeQL analyses the code
and the workflows on every pull request too; its findings appear on the pull
request and under Security, without blocking the merge.

## Licence of contributions

The project is under the [GNU Affero General Public License v3.0](LICENSE), and
its author also offers it under other terms, commercial ones included. By
opening a pull request you agree that your contribution may be distributed
under the AGPL and under any licence the author chooses, and you confirm that it
is yours to give on those terms.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), checked by
commitlint on every commit through a git hook and again in CI on every commit a
pull request brings. The release notes are built from these messages, so a
message CI cannot read is refused before the merge.

```
type(scope): what changed, in the imperative

Why, wrapped at 100 columns.
```

- `type` is one of `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `ci`,
  `build`, `chore`, `style` or `revert`. `scope` is optional and kebab-case.
- The header is at most 72 characters.

- A breaking change adds `!` after the type or scope (`feat(api)!: …`), or a
  `BREAKING CHANGE:` footer.

## Releases and versions

Every merge into `main` is released: a tag `vMAJOR.MINOR.PATCH` and a
[GitHub Release](https://github.com/rafaeldailymartins/gitlab-dashboard/releases)
whose notes list the commits since the previous version, grouped by type.

| The commits since the last version include | The version raises |
| ------------------------------------------ | ------------------ |
| a breaking change                          | major              |
| a `feat`, and nothing breaking             | minor              |
| anything else                              | patch              |

- The rules live in `cliff.toml`, and the `release` job in
  `.github/workflows/ci.yml` applies them after every check on `main` has passed.
- The first version is `v2.0.0`, the app as it stood before releases were tagged.
- **Every release carries its source and a signed statement of where it came
  from.** `gitlab-dashboard-<version>.tar.gz` is the commit the release was cut
  from, and `….tar.gz.sigstore.json` is a Sigstore attestation that this
  repository's `release` job built it. Check one with
  `gh attestation verify gitlab-dashboard-<version>.tar.gz --repo rafaeldailymartins/gitlab-dashboard`.
  It is the source rather than `dist/`: production runs Netlify's own build of
  the same commit.
- **The tags are the only record of a version.** There is no `CHANGELOG.md` and
  no `version` in `package.json` — the releases page is the changelog. Tags
  `v*` cannot be moved or deleted.
- Rolling production back is Netlify's "publish deploy" on an earlier deploy;
  `docs/qa/release-checklist.md` has the rest of that procedure.

## When a merge does not start anything

GitHub has dropped the push event of a merge outright, with its status page all
green: the branch moves, and nothing else happens — no CI run, no release, no
deploy. If a few minutes after a merge the Actions tab shows no run for it:

- **On `main`:** Actions → CI → **Run workflow** on `main`. A manual run on
  `main` does everything a push does, the release and the coverage badge
  included. Netlify did not see the push either, so trigger a production deploy
  from the Netlify dashboard (Deploys → Trigger deploy).
- **On `staging`:** the same Run workflow on `staging` gives its head the checks
  a promotion needs. For its deploy, the next merge into `staging` rebuilds it,
  or a Netlify build hook for the `staging` branch does it now.

## Planning a change

A change to behaviour is planned with OpenSpec before it is written — proposal,
specs, design, tasks — and `AGENTS.md` has the architecture, the gates and the
decisions a change is expected to respect.
