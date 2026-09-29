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

## Checks

Every pull request runs `verify`, `test`, `build`, `e2e` and `commit-messages`;
one into `main` also needs `branch-policy`. Run `bun run verify && bun run test`
before you open it — the git hooks run part of that on every commit and push,
and CI runs all of it.

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
- **The tags are the only record of a version.** There is no `CHANGELOG.md` and
  no `version` in `package.json` — the releases page is the changelog. Tags
  `v*` cannot be moved or deleted.
- Rolling production back is Netlify's "publish deploy" on an earlier deploy;
  `docs/qa/release-checklist.md` has the rest of that procedure.

## Planning a change

A change to behaviour is planned with OpenSpec before it is written — proposal,
specs, design, tasks — and `AGENTS.md` has the architecture, the gates and the
decisions a change is expected to respect.
