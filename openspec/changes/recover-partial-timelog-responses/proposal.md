## Why

A second reader of the deployed dashboard sees an empty screen and the notice
"GitLab refused the request", permanently. GitLab did not refuse it. It answered
`200` with twenty-five of her timelogs in `data` and, beside them, three errors:

```
"Cannot return null for non-nullable field Timelog.project"
  path: currentUser.timelogs.nodes.7.project
```

`Timelog.project` is non-nullable in GitLab's schema and the connection's list
items are not, so GraphQL's null propagation replaces each affected timelog with
`null` — the whole entry, not just its project. GitLab does this when the reader
logged time in a project it can no longer resolve for them: access lost, or the
project archived, removed, or moved to another group. Three of her entries fall
on working days, so close to a day and a half of her hours are inside them.

Two of our own decisions turn that partly usable answer into no answer at all:
`dataOf` throws as soon as `errors` is non-empty, discarding the `data` it was
handed, and `nodes: z.array(timelogSchema)` would reject the `null` items even
if it did not. The failure is classified `rejected`, which the query client does
not retry, and no earlier figures exist to fall back on. GraphQL's specification
treats data and errors as coexisting; we treat their coexistence as total
failure.

Dropping the null entries would fix the empty screen and introduce a quieter
fault: her hours would be short by whatever is in them, with nothing on screen
saying so. This dashboard already refuses to present a floor as a final total
(REPORT-3), and it counts time logged without a work item rather than omitting
it (REPORT-7). Time logged in a project that cannot be read deserves the same
treatment.

## What Changes

- A response carrying `data` alongside `errors` is used. Only a response with no
  usable data is a failure, and it keeps the classification it has today. The
  GraphQL client stops throwing away what GitLab did answer, and reports the
  errors beside the data instead of swallowing them.
- The adapter accepts a `null` entry in the timelog connection instead of
  rejecting the page.
- When entries come back null, one further request for the same page — same
  cursor, same size — omits `project`, the field whose resolver failed, and
  recovers their instant, duration, summary and work item. Those entries are
  counted with no project rather than lost. The extra request is made only when
  a page actually has null entries.
- **BREAKING** (internal): `TimelogEntry.project` becomes nullable. Every
  aggregation counts an entry whose project could not be read: day totals,
  period totals, the work-item rollup, the project split and the top items
  table. The project split gains one bucket for them.
- The screens name that bucket, and a row with no project, from
  `messages/{en,pt-BR}.json`.
- A report says how many entries were counted without their project, and how
  many could not be recovered at all. The second number means the totals are
  short, and the reader is told so rather than shown a figure that looks whole.

## Capabilities

### Modified Capabilities

- `personal-timelog-report`: an answer that is partly usable is used rather than
  discarded (REPORT-10); time logged in a project that cannot be read is
  recovered, counted, and presented with no project (REPORT-11). REPORT-11
  qualifies the breakdown REPORT-5 defines rather than amending it: the main
  specs have not been synced yet, so a `MODIFIED` block would have no merged
  requirement to match at archive time.
- `dashboard-ui`: the screens present an entry with no readable project, and
  report how much of the answer could not be read (UI-15).

## Impact

- `src/shared/api/graphql.ts` — `dataOf` returns data with errors beside it;
  `GraphQLClient.request` changes shape. `src/shared/api/graphql.test.ts` covers
  partial responses.
- `src/entities/timelogs/api/schemas.ts` — nullable list items, and a schema for
  the response that omits `project`.
- `src/entities/timelogs/api/gitlab-timelog-gateway.ts` — the fallback request
  and the merge of the two answers.
- `src/entities/timelogs/model/` — `types.ts` (nullable `project`),
  `ports.ts` (`TimelogPage` reports what could not be read), `aggregate.ts:118`
  and `rollup.ts:51,112` (keys built from `project.fullPath`), and a pure
  reconciliation of recovered entries against the ones already read. 100%
  coverage and the 85% mutation floor apply here.
- `src/widgets/hours-report/lib/use-hours-report.ts` — carries the counts to the
  screens; `src/widgets/hours-report/ui/sync-control.tsx` reports them.
- `src/pages/dashboard/ui/day-row.tsx`,
  `src/pages/dashboard/ui/work-item-row.tsx`,
  `src/pages/day-detail/ui/work-item-list.tsx`,
  `src/pages/insights/ui/project-split.tsx`,
  `src/pages/insights/ui/top-items-table.tsx` — an absent project.
- `messages/en.json`, `messages/pt-BR.json` — new keys, both languages, held by
  `bun run i18n:check`.
- `tests/support/gitlab-timelogs.ts` and `tests/e2e/support/` — a partial
  response fixture shaped from the recorded one, and the `project`-less
  response beside it.
- `features/domain/*.feature` and `features/acceptance/*.feature` — scenarios
  citing the new requirements, as `bun run arch:trace` requires.
- No dependency changes.
