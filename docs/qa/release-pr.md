Promotes `staging` to `main`. Merging this builds production's deploy and
publishes the next release, computed from the commits below — see
`CONTRIBUTING.md`. The deploy goes live when it is published by hand in Netlify.

Worked through on https://staging--gitlabdashboard.netlify.app before merging.
Each step is explained in `docs/qa/release-checklist.md` § On staging.

## Staging

- [ ] Signed in end to end against real GitLab, and landed back on staging.
- [ ] Today's hours match GitLab's own report.
- [ ] Hard-refreshed `/days/<a date>`: the app, not a 404.
- [ ] Saved a team. It survives a reload, and the `PUT` carried
      `x-document-version` and was answered `200` with `x-document-version`.
- [ ] **Saved that team a second time**, and that `PUT` named the version the
      first answer carried and was a `200`, not a `409`.
- [ ] Changed a weekday target in `/settings` twice, cleared this device's
      `preferences` key and reloaded: the value came back, and both `PUT`s were
      a `200`.
- [ ] **The team saved above is not listed in production.**
- [ ] Worked the manual pass in `docs/qa/regression-checklist.md` for what this
      promotion changes.

## After merging

- [ ] Published this merge's deploy in Netlify, with the lock left on, and
      production serves it rather than one built before it.
- [ ] Production still lists the teams it had before, and a save there works —
      a second save included.
- [ ] The release for this merge is published, and its notes read right.
