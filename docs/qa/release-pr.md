Promotes `staging` to `main`. Merging this deploys production and publishes the
next release, computed from the commits below — see `CONTRIBUTING.md`.

Worked through on https://staging--gitlabdashboard.netlify.app before merging.
Each step is explained in `docs/qa/release-checklist.md` § On staging.

## Staging

- [ ] Signed in end to end against real GitLab, and landed back on staging.
- [ ] Today's hours match GitLab's own report.
- [ ] Hard-refreshed `/days/<a date>`: the app, not a 404.
- [ ] Saved a team. It survives a reload, and the `PUT` carried
      `x-document-version` and was answered `200` with an `ETag`.
- [ ] Changed a weekday target in `/settings`, cleared this device's
      `preferences` key and reloaded: the value came back, and its `PUT` was a
      `200` too.
- [ ] **The team saved above is not listed in production.**
- [ ] Worked the manual pass in `docs/qa/regression-checklist.md` for what this
      promotion changes.

## After merging

- [ ] Production still lists the teams it had before, and a save there works.
- [ ] The release for this merge is published, and its notes read right.
