# Tasks

## 1. The budget

- [x] 1.1 `.size-limit.js`: `limit` from `180 kB` to `196 kB`, with a comment
      saying which updates moved it, by how much each, and that the owner chose
      the budget over holding them back. Gate: `bun run build && bun run size`
      passes on the runtime group's branch, at about 195.6 kB
- [x] 1.2 The documents that state the budget as current say 196 kB:
      `AGENTS.md` (commands table), `README.md` and `README.pt-BR.md` (the gate
      table, in both languages), `docs/qa/quality-metrics.md` (the gate row and
      its measured value) and `docs/qa/release-checklist.md`. Measurements made
      against 180 kB — in `AGENTS.md`'s decisions, `quality-metrics.md`'s
      history and the comments in `day-control.tsx` and `report-toolbar.tsx` —
      stay as recorded, reworded only where they claim 180 kB is the budget
      today. Check: `git grep -n "180 kB"` returns only historical measurements

## 2. The deprecated call

- [x] 2.1 `src/widgets/team-manager/lib/use-group-seeding.ts` and
      `src/shared/api/query-client.test.ts`: `QueryClient.fetchQuery` →
      `QueryClient.query`, which TanStack Query 5.104 names as its replacement.
      Gate: `bun run lint` reports no deprecation, and `bun run test` passes

## 3. Everything together

- [x] 3.1 `bun run verify && bun run test`, `bun run build && bun run size` and
      `bun run test:e2e` pass on the runtime group's branch, and its pull
      request's checks go green
