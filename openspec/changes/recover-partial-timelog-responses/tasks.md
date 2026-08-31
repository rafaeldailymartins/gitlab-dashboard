## 1. The response shapes the suite never had

- [x] 1.1 Add a partial-response fixture to `tests/support/gitlab-timelogs.ts`, shaped from the recorded production response: `data.currentUser.timelogs.nodes` with `null` at three positions, and the matching `errors` array of `Cannot return null for non-nullable field Timelog.project` with their `path` values; verify `bun run test` still passes with the fixture unused
- [x] 1.2 Add the `project`-less recovery response beside it — the same entries with no `project` member and no `errors`; verify `bun run test` passes
- [x] 1.3 Add the same two shapes to `tests/e2e/support/` so the browser can be served them; verify `bun run test:e2e` still passes before any behaviour changes

## 2. Model layer, test-first

- [x] 2.1 Write the failing tests for the reconciliation rule in `entities/timelogs/model/`: a recovered entry the primary answer did not return is counted; an entry present in both answers is counted once; two entries identical on every readable field are both counted; nothing beyond the withheld count is ever taken; verify with `bun run test`
- [x] 2.2 Implement the pure bounded multiset difference until 2.1 passes, keyed on instant, duration, work item reference and summary per design.md; verify `bun run test`
- [x] 2.3 Make `TimelogEntry.project` nullable in `model/types.ts` and fix `aggregate.ts:118`, `rollup.ts:51` and `rollup.ts:112` to key on `project?.fullPath ?? NO_PROJECT` with a constant that is not a valid GitLab path; verify `bun run typecheck` and `bun run test`
- [x] 2.4 Add tests proving an entry with no project is counted in its day total, in every period total covering it, and in the work-item breakdown, and that the split by project groups every unreadable project as one `project: null` bucket; verify `bun run test`
- [x] 2.5 Extend `TimelogPage` in `model/ports.ts` with the `withheld` and `recovered` counts, reading a missing count as zero for a page restored from cache; verify `bun run test`
- [x] 2.6 Confirm the model floors still hold: `bun run test:coverage` (100% on `model/`) and `bun run test:mutation` (≥85%, covering the multiset arithmetic)

## 3. The GraphQL boundary

- [x] 3.1 Write the failing tests in `src/shared/api/graphql.test.ts`: a payload with `data` and `errors` together returns the data with the error messages beside it; a payload with `errors` and no `data` throws `kind: 'rejected'`; a payload whose `data` is present is used regardless of what `errors` holds; verify `bun run test`
- [x] 3.2 Change `GraphQLClient.request` to return `{ data, errors }` and make `dataOf` throw only when there is no usable data; verify `bun run test` and `bun run typecheck`
- [x] 3.3 Confirm `data.currentUser === null` still means an empty report rather than a failure, with a test that says so; verify `bun run test`

## 4. The adapter

- [x] 4.1 Make the timelog connection's list items nullable in `api/schemas.ts` and add the schema for the `project`-less response; verify the 1.1 and 1.2 fixtures parse, with `bun run test`
- [x] 4.2 Add the second static query document — `MyTimelogs` minus the `project` selection — and a gateway test asserting it carries the same `first` and `after` and names no `project`; verify `bun run test`
- [x] 4.3 Issue the recovery request from the gateway only for a page whose answer contained a null entry, and reconcile with the 2.2 function; verify with tests that the request fires exactly once for the partial fixture, and not at all for the complete one, with `bun run test`
- [x] 4.4 Add the worst-case test: a payload where every entry is null neither throws nor invents an entry, and reports what it could not read; verify `bun run test`
- [x] 4.5 Keep `myTimelogs` and the recovery branch inside the complexity and length ceilings by splitting them into separate functions; verify `bun run lint`

## 5. The report

- [x] 5.1 Carry the counts through `widgets/hours-report/lib/use-hours-report.ts` as entries counted without a project and entries that could not be read, summed across loaded pages, without touching the `settled` flag; verify `bun run test`
- [x] 5.2 Add a test proving an unread entry does not drive further page requests; verify `bun run test`
- [x] 5.3 Report both counts in `widgets/hours-report/ui/sync-control.tsx`, saying nothing when both are zero; verify its component tests with `bun run test`

## 6. The screens and the messages

- [x] 6.1 Add the message keys for a project that could not be read and for the two counts to `messages/en.json` and `messages/pt-BR.json`; verify `bun run i18n:check`
- [x] 6.2 Present an absent project in `pages/dashboard/ui/day-row.tsx`, `pages/dashboard/ui/work-item-row.tsx` and `pages/day-detail/ui/work-item-list.tsx`, including the row keys that currently fall back to `project.fullPath`; verify their component tests with `bun run test`
- [x] 6.3 Name the unreadable group in `pages/insights/ui/project-split.tsx` and the unreadable project in `pages/insights/ui/top-items-table.tsx`; verify `bun run test`
- [x] 6.4 Confirm nothing new breaks the visual gates: `bun run lint:a11y` and `bun run a11y:contrast`

## 7. Traceability

- [x] 7.1 Add domain scenarios to `features/domain/` covering REPORT-10 and REPORT-11, each carrying its `# Spec: personal-timelog-report / REPORT-N` comment, with step definitions in `tests/domain/`; verify `bun run test` and `bun run arch:trace`
- [x] 7.2 Add the acceptance scenarios to `features/acceptance/` covering UI-15, citing `dashboard-ui / UI-15`; verify `bun run arch:trace`

## 8. The end-to-end regression

- [x] 8.1 Serve the recorded partial response in the browser and assert the dashboard shows hour figures rather than the refusal notice — the reported symptom, reproduced and fixed; verify `bun run test:e2e`
- [x] 8.2 Assert in the browser that the unreadable project is named and that the counts are reported, with the `axe-core` assertion the other acceptance scenarios carry; verify `bun run test:e2e`

## 9. Every gate

- [x] 9.1 Run `bun run verify && bun run test`, then `bun run test:coverage`, `bun run test:mutation` and `bun run test:e2e`
- [x] 9.2 Run `bun run build && bun run size` and confirm the 180 kB gzip budget still holds
- [ ] 9.3 Confirm the fix against the real account that reported it: her history contains the withheld entries, so the deployed dashboard either shows her hours with the counts beside them or it does not
