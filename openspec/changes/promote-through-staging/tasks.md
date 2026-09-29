# Tasks

Steps marked **(owner)** change something outside the working tree — a tag, a
branch, a platform setting — and are taken only with the owner's go-ahead at the
time.

## 1. Baseline

- [ ] 1.1 **(owner)** Release `main` as it stands as `v2.0.0`:
      `gh release create v2.0.0 --target <main sha>` with a note saying it is the
      baseline everything before tagged releases is folded into. Verify:
      `gh release view v2.0.0` shows the tag on that commit
- [ ] 1.2 **(owner)** Create `staging` from `main` and push it. Branch deploys
      stay off until 6.2, so nothing deploys from it yet — the old bundle names
      `readers` unconditionally and must not run there. Verify:
      `git ls-remote --heads origin staging`

## 2. Traceability, before anything cites it

- [x] 2.1 DELIVERY-1, DELIVERY-2 and DELIVERY-3 in `UNCITED_BY_DESIGN` in
      `scripts/check-traceability.ts`, each naming the gate that proves it:
      the `functions` tests for the store, the `branch-policy` check and the
      rulesets for the flow, the release job and the `commit-messages` check
      for versions. Gate: `bun run arch:trace`

## 3. The store follows the deploy, test-first

- [x] 3.1 `netlify/lib/store-name.mts` and its test, written first: `production`
      → `readers`; `branch-deploy`, `deploy-preview` and `dev` →
      `readers-staging`; a missing context or any other value → no store. Gate:
      `bun run test:coverage` (`functions` project, every branch of the mapping)
- [x] 3.2 `blobDocumentStore(name)` takes the store name and keeps its region
      and consistency. Gate: `bun run typecheck`
- [x] 3.3 `documentEndpoint` becomes `(request, context)`: it resolves the store
      name first, answers the unavailable `503` when there is none without
      calling the store factory, and hands the name to that factory. Tests in
      `document-endpoint.test.mts`: a production context reaches `readers`, a
      preview and a branch deploy reach `readers-staging`, and a missing or
      unknown context is refused with the factory never called (DELIVERY-1,
      "A deploy that cannot say what it is"). Gate: `bun run test`
- [x] 3.4 `netlify/functions/{teams,preferences}.mts` pass the function's
      `context` through. Gate: `bun run typecheck`, `bun run deadcode`
- [x] 3.5 `config/vite/api-dev.ts` passes a `dev` context and keeps its memory
      store. Verify: under `bun run dev`, save a team and reload — it is still
      there

## 4. CI and releases

- [ ] 4.1 `ci.yml` runs on `push` to `staging` as well as `main`. Verify: the
      workflow parses, and after 6.1 a push run appears for `staging`
- [x] 4.2 The `branch-policy` job on `pull_request` (design § 2). Verify: its
      script run locally with the event fields of the five DELIVERY-2 branch
      scenarios passes and fails exactly as the scenarios say
- [x] 4.3 The `commit-messages` job on `pull_request`, reading
      `commitlint.config.js` over `base..head` (design § 5). Verify:
      `bun commitlint --from origin/staging --to HEAD` passes on this branch and
      fails on a scratch commit whose message is `fixed stuff`
- [ ] 4.4 `cliff.toml` at the root, with the parsers, groups, merge-commit skip,
      tag pattern and `[bump]` rules of design § 4. Verify, once `v2.0.0` exists:
      `git cliff --bumped-version` answers `v2.1.0`, and
      `git cliff --unreleased --tag v2.1.0` lists this change's commits by type
      and no merge commit
- [x] 4.5 The `release` job in `ci.yml`: after `verify`, `test`, `build` and
      `e2e`, on a push to `main` only, `contents: write`, full history, the
      git-cliff action pinned to a commit SHA, one
      `gh release create --target <sha> --notes-file`, and a stop when the
      version already exists. Verify: the workflow parses; 7.2 is its first run
- [x] 4.6 The unused `version` field leaves `package.json`. Gate:
      `bun install --frozen-lockfile`, `bun run verify`

## 5. Documentation

- [x] 5.1 `CONTRIBUTING.md`: environments and their stores, branch names by
      commit type, which branch each pull request targets, hotfixes and the
      back-merge, merge commits only, promotion, how a version is computed, the
      commit-message format, and a link to the release checklist
- [x] 5.2 `docs/qa/release-pr.md`: the promotion pull request's body — the
      checklist steps only a real deploy can answer, as checkboxes, including
      both store checks
- [x] 5.3 `docs/qa/release-checklist.md`: "On the deploy preview" becomes
      "On staging"; the two store checks; the rollback note that reverting the
      store change orphans `readers-staging` harmlessly
- [x] 5.4 `AGENTS.md`: a pointer to `CONTRIBUTING.md` beside the commit
      convention, and a decision entry on why the store follows the deploy and
      why an unknown deploy is refused
- [x] 5.5 `README.md` and `README.pt-BR.md`, in step: a short Contributing
      section, and the staging address in the deployment section
- [x] 5.6 `openspec/config.yaml`: the context names both stores
- [ ] 5.7 Every gate before the pull request. Gate:
      `bun run verify && bun run test`

## 6. Delivered through staging

- [ ] 6.1 A pull request from `feat/promote-through-staging` into `staging`,
      merged when every check is green — `branch-policy` and `commit-messages`
      included, which is their first run
- [ ] 6.2 **(owner)** Netlify: branch deploys for `staging` alone, and
      `VITE_GITLAB_CLIENT_ID` available to the branch-deploy context. Verify:
      the site's allowed branches are `main` and `staging`, and a deploy of
      `staging` is live at `https://staging--gitlabdashboard.netlify.app`
- [ ] 6.3 **(owner)** `https://staging--gitlabdashboard.netlify.app/auth/callback`
      on the GitLab OAuth application. Verify: signing in there returns to the
      staging address signed in (DELIVERY-2, "Signing in on homologation")
- [ ] 6.4 On staging, save a team and confirm production does not list it, and
      that the Blobs browser shows it under `readers-staging` (DELIVERY-1, "A team
      saved in homologation")
- [ ] 6.5 **(owner)** Rulesets: `staging` as design § 6; on `main`, the up-to-date
      requirement off and `branch-policy` and `commit-messages` required; tags
      `v*` protected from update and deletion. Verify:
      `gh api repos/rafaeldailymartins/gitlab-dashboard/rules/branches/staging`
      and `…/rules/branches/main` list those rules

## 7. The first promotion

- [ ] 7.1 **(owner)** A pull request from `staging` into `main` with
      `docs/qa/release-pr.md` as its body, its checkboxes worked through on
      staging. Verify: `branch-policy` passes on it (DELIVERY-2, "A promotion")
- [ ] 7.2 After the merge, `v2.1.0` is tagged and released with notes listing
      this change's commits by type. Verify: `gh release view v2.1.0`
      (DELIVERY-3, "A promotion carrying a feature")
- [ ] 7.3 On production, the teams that were there before are still listed and
      a save still works. If not, publish the previous deploy and read the
      context the function received (design § Risks)
