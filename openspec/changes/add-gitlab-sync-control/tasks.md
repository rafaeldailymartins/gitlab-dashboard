`bun run verify && bun run test` must pass before a task is considered done, and
each task names whatever additional gate proves it.

## 1. Formatting

- [x] 1.1 Add `formatTimeOfDay` and `formatShortDate` to `src/shared/lib/format.ts`, both built on the cached-formatter pattern already there; verify unit tests assert the `en` and `pt-BR` output for the same instant, and that the zone argument — not the machine's zone — decides the hour (UI-14, I18N-4)

## 2. The report's sync surface

- [x] 2.1 Replace `isRefreshing`/`retry` on `HoursReport` with `syncing`, `sync` and `syncedAt`, reading `isFetching`, `refetch` and `dataUpdatedAt` from the query; verify the existing report tests still pass (UI-13, UI-14)

## 3. The control

- [x] 3.1 Add `src/widgets/hours-report/ui/sync-control.tsx` — one `role="status"` region, the state text, and a ghost icon button that turns while syncing; delete `report-notice.tsx` and its export (UI-13, UI-14)
- [x] 3.2 Write component tests for all four states — never synced, syncing, synced today, synced on an earlier day — and for a press asking the gateway again; verify `bun run test:coverage` stays above its floor (UI-13, UI-14)
- [x] 3.3 Place the control in the dashboard, insights and day headers, pinned to the end of the header row; verify `bun run test:e2e` reports no layout shift and no accessibility violation on any screen (UI-8, UI-9, UI-11)

## 4. Strings and traceability

- [x] 4.1 Add `sync_action`, `sync_in_progress`, `sync_updated_at`, `sync_updated_on` and `sync_never` to both catalogues and remove `report_up_to_date`, `report_refreshing` and `report_retry`; verify `bun run i18n:check` (I18N-4)
- [x] 4.2 Add `features/acceptance/sync-with-gitlab.feature` citing UI-13 and UI-14, and point the existing retry step at the sync control; verify `bun run arch:trace` (UI-13, UI-14)
- [x] 4.3 Teach `scripts/check-traceability.ts` to read every active change rather than one named one, so a second change's requirements are held to the same thread; verify `bun run arch:trace` still names the totals it found
