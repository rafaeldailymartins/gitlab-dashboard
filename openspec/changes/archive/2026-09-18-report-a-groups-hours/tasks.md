## 1. The ground this screen stands on

- [x] 1.1 Memoise `formatSpokenHours` in `src/shared/lib/format.ts` with a formatter Map like its three neighbours, and add a `dayWithWeekday` style (`{day, month, weekday}`, no year) to `DATE_STYLES`; verify `bun run test` and that the existing dashboard tests still pass
- [x] 1.2 Memoise the validated-time-zone check in `src/shared/lib/date.ts` so `toIsoDate` stops constructing two `Intl` formatters per call, keeping the `RangeError` for an unrecognised zone; verify `bun run test` and `bun run test:coverage`
- [x] 1.3 Add `isoWeekOf` and `isoWeekYearOf` to `src/shared/lib/date.ts` over date-fns on the UTC-pinned `TZDate`, with tests covering 1 January belonging to the previous ISO week-numbering year; verify `bun run test` at 100% on the module
- [x] 1.4 Export `DateRange`, `PeriodTotal` and `secondsToHours` from `src/entities/timelogs/index.ts` so the new slice reaches them through the public API; verify `bun run arch:layers` and `bun run deadcode`
- [x] 1.5 Add `flex-wrap` to the `<nav>` in `src/app/routes/_authenticated.tsx`; verify the 375 px assertion still passes on every existing screen with `bun run test:e2e`
- [x] 1.6 **Not needed.** The group picker is a labelled search field over a list of buttons rather than a combobox: the interaction is type-then-press, and a listbox with a roving focus would add ARIA to get subtly wrong for nothing. No vendored file, no coverage exclusion, no bundle cost; verify `bun run lint` and `bun run build && bun run size`

## 2. The fixtures, before anything reads them

- [x] 2.1 Add `tests/support/gitlab-group-timelogs.ts` with fixtures shaped from a recorded response: a roster page, a timelog page with `user`, a page whose `count`/`totalSpentTime` exceed what its nodes hold, a page with zero nodes and `hasNextPage: true`, and a `group: null` answer with its error; verify `bun run test` passes with the fixtures unused
- [x] 2.2 Add `tests/e2e/support/gitlab-groups.ts` with `stubGroupHours`, `stubGroupWithheldEntries`, `stubUnreadableGroup` and `stubEmptyGroup`, in its own file so `gitlab-api.ts` stays under the 200-line ceiling; verify `bun run test:e2e` still passes before any behaviour changes
- [x] 2.3 Make `tests/e2e/support/gitlab-api.ts` dispatch on the GraphQL **operation name** before its existing `includes('timelogs')` check — `GroupHoursPage` contains that substring and would otherwise be answered with the personal payload, and the suite would pass on the wrong data; verify `bun run test:e2e`

## 3. Model layer, test-first — the window (GROUP-2)

- [x] 3.1 Write the failing tests for `readerWindow(month)` in `src/entities/group-timelogs/model/window.test.ts`: the window is widened one whole UTC day either side; both bounds are pure `Z` instants; `from < to` for every month; the reader's first local day at UTC+14 and last local day at UTC−12 both fall inside; verify `bun run test`
- [x] 3.2 Implement `readerWindow` until 3.1 passes; verify `bun run test`
- [x] 3.3 Write and pass the tests for `entriesWithin`: an entry on the month's first local day in `America/Sao_Paulo` is inside, the same instant read in `Asia/Tokyo` may not be, an entry in the padding days is dropped, and the range includes its edges; verify `bun run test`

## 4. Model layer, test-first — rows, columns and cells (GROUP-3, 4, 5, 13)

- [x] 4.1 Write and pass the tests for `people(roster, entries)`: a member who logged nothing gets a row; a contributor who is not a member gets a row; a bot member does not; a non-active member does not; a non-member contributor is never filtered; ordering is by name then username with plain code-unit comparison so it cannot vary by machine; verify `bun run test`
- [x] 4.2 Write and pass the tests for `columnsOf(request)`: one column per day in `days`; one column per ISO week in `weeks`; `referenceHours` is zero where the reference expects nothing; a week column at a month boundary counts only the days inside the month; verify `bun run test`
- [x] 4.3 Write and pass the tests for `weekBandsOf(columns)`: bands span whole ISO weeks clipped to the month, carry the ISO week-numbering year, and a month starting mid-week produces a short first band; verify `bun run test`
- [x] 4.4 Write and pass the tests for cell kinds: `logged` when the day has entries; `pending` past `loadedThrough`; `future` past `today`; `non-working` when nothing is expected; `unlogged` otherwise — with a case on each side of the `today` and `loadedThrough` boundaries so the comparison-operator mutants die; verify `bun run test`
- [x] 4.5 Write and pass the test that a day holding an entry and its correction is a `logged` cell with no hours, distinct from a cell with no entries; verify `bun run test`

## 5. Model layer, test-first — totals and the shortfall (GROUP-6, 8, 9)

- [x] 5.1 Write and pass the test for the arithmetic identity: the grand total in seconds equals the sum of the row totals and the sum of the column totals, and every total is accumulated in seconds and converted once; verify `bun run test`
- [x] 5.2 Implement `teamGrid(request)` until 4.1–5.1 pass, keeping every function inside the 40-line, 8-complexity and 3-parameter ceilings; verify `bun run test` and `bun run lint`
- [x] 5.3 Write and pass the tests for the shortfall: `declared − visible` is reported **signed**; a positive residual means hours are missing; a negative residual means the figures may be too high and is not reported as nothing missing; a zero residual reports nothing at all; verify `bun run test`
- [x] 5.4 Write and pass the tests for the per-person shortfall: a person whose declared total exceeds their visible total carries the difference on their row; a person with a declared total and no visible entries is distinguishable from a person with neither; verify `bun run test`
- [x] 5.5 Implement `groupReportFrom(pages, options)` returning the grid, the access level, the completeness flag, `loadedThrough` and the shortfall; verify `bun run test`
- [x] 5.6 Confirm the model floors: `bun run test:coverage` (100% on `model/`) and `bun run test:mutation` (≥85%, covering the window arithmetic, the cell-kind precedence and the signed residual)

## 6. The GraphQL boundary

- [x] 6.1 Write `src/entities/group-timelogs/api/documents.ts` with the three documents from design.md — `GROUP_HOURS_PAGE` (no `count`, no `totalSpentTime`, no `project`), `GROUP_MONTH_PROBE` (`first: 1`, group name, `maxAccessLevel`, window aggregates, one `timelogs(username:)` alias per person) and `GROUP_ROSTER` (`relations: [DIRECT, DESCENDANTS]`) — each carrying the comment saying why it is shaped that way; verify a gateway test asserts each document sends `startTime` and `endTime` and never `startDate` or `endDate`, with `bun run test`
- [x] 6.2 Write `api/schemas.ts`: nullable connection nodes, `totalSpentTime` coerced from its BigInt **string**, and nullable `Group.name`, `Timelog.spentAt`, `GroupMember.user`, `GroupMember.accessLevel`, `AccessLevel.integerValue` and `AccessLevel.stringValue` — all six are nullable in GitLab's schema and one null takes the whole page; verify the 2.1 fixtures parse, with `bun run test`
- [x] 6.3 Write and pass the gateway tests: paging stops on `hasNextPage === false` and on nothing else, so a page with zero nodes and `hasNextPage: true` still asks for the next one; `group: null` with authorization errors classifies as `rejected` and anything else as `unavailable`; the probe batches at most 32 person aliases; the roster pages to exhaustion inside the gateway; verify `bun run test`
- [x] 6.4 Implement `api/gitlab-group-timelog-gateway.ts` as a thin factory delegating to top-level functions, so no function exceeds the 40-line ceiling and the file stays under 200 lines; verify `bun run lint` and `bun run test`
- [x] 6.5 Add `ui/gateway-provider.tsx` mirroring `entities/timelogs/ui/gateway-provider.tsx`, and `index.ts` exporting only what crosses the slice boundary; verify `bun run test`, `bun run arch:layers`, `bun run arch:graph` and `bun run deadcode`

## 7. Queries, caching and wiring (GROUP-18)

- [x] 7.1 Write `api/queries.ts`: `groupHoursQuery` as an infinite query keyed `['group-timelogs', fullPath, month]` with `gcTime` 30 minutes and `refetchOnWindowFocus: false` — a focus refetch re-runs every page of an infinite query; plus `groupRosterQuery` and `groupSearchQuery`; verify `bun run test`
- [x] 7.2 Exclude the group keys from the persister in `src/app/routes/__root.tsx` via `dehydrateOptions.shouldDehydrateQuery`, and write the test proving a group report is not restored from storage; verify `bun run test`
- [x] 7.3 Construct the gateway in `src/app/lib/runtime.ts` from the same GraphQL client, without making it a module-scope dependency of the root chunk, and mount its provider in `__root.tsx`; verify `bun run build && bun run size` against the 180 kB budget
- [x] 7.4 Add `src/app/routes/_authenticated.team.tsx` with `validateSearch` coercing `group`, `month` and `by`, plus `lib/search-params.ts` and its tests covering a month that is not a real month and a missing group; verify `bun run test` and `bun run typecheck`
- [x] 7.5 Add the `/team` navigation link; verify `bun run test` and `bun run lint`

## 8. The screen (GROUP-1, 7, 10, 11, 12, 14, 15, 16, 17)

- [x] 8.1 Add the ~30 message keys to `messages/en.json` and `messages/pt-BR.json`, reusing `hours_short`, `dashboard_still_loading` and the target phrases rather than restating them; verify `bun run i18n:check`
- [x] 8.2 Add the two new colour pairs to `scripts/contrast/pairs.ts` — the non-working tint and the reference rule — using `--chart-empty` and never `--muted`, which measures 1.12 against `--card` in the dark theme; verify `bun run a11y:contrast` measures them rather than assuming them
- [x] 8.3 Narrow `widgets/hours-report`'s `SyncControl` to a status plus a list of notices, move `withheldNotices` into `widgets/hours-report/lib/`, and update the three existing call sites; verify their component tests and `bun run test`
- [x] 8.4 Build `ui/team-matrix.tsx`: one named scroll region with `tabindex="0"` and a visible focus ring, a `<table>` with `border-separate`, explicit `<col>` widths, an `sr-only` `<caption>` naming the scope, and a real visible header on the person column — an empty `<th>` fails axe's `empty-table-header`; verify `bun run lint:a11y` and `bun run test`
- [x] 8.5 Split the header into `week-band-row.tsx` and `day-header-row.tsx` so neither exceeds the 60-line component ceiling, with `scope="colgroup"` bands over real `<colgroup>` elements and the week also folded into each day header's spoken text; verify `bun run lint`
- [x] 8.6 Build `ui/day-cell.tsx` for all five cell kinds, using `HourFigure` and never `aria-label` on a generic element, with the tint on the cell rather than the `<col>` so a row hover cannot erase it, and no sentence in the cell repeating the person or the date; verify its component tests with `bun run test`
- [x] 8.7 Draw over-reference as the bar crossing a dashed reference rule at the 100% mark rather than as a colour change, and state the reference in the legend; verify `bun run a11y:contrast` and the component test asserting the two states differ without hue
- [x] 8.8 Build `ui/matrix-row.tsx` and `ui/matrix-foot.tsx` with the sticky person and total columns, the per-person shortfall beside a short total, and the row treatment that distinguishes "logged nothing" from "nothing readable"; verify `bun run test`
- [x] 8.9 Memoise the row component so a forty-person month does not re-render 1240 cells on every re-order or hover; `content-visibility` is deliberately **not** applied to a `<tr>` — with no intrinsic size an off-screen row collapses and takes the column widths with it, and the reserved-space cells already make the renders during paging cheap; verify `bun run test`
- [x] 8.10 Build `ui/group-picker.tsx` over `groupSearchQuery`, seeded from the reader's own groups and searching `Query.groups` so a group reached through an ancestor is findable, plus `ui/month-stepper.tsx` and `ui/granularity-toggle.tsx` writing to the URL; verify `bun run test`
- [x] 8.11 Build `ui/team-hours-page.tsx` with the state resolved by a pure `lib/state.ts` returning a discriminated union and rendered through a lookup — `react/jsx-no-leaked-render` allows ternaries only and `sonarjs/no-nested-conditional` is on, so a chain over ten states cannot be written inline and a ten-arm switch exceeds the complexity ceiling; verify `bun run lint` and `bun run test`
- [x] 8.12 Add `lib/notices.ts` and its tests as the one place the shortfall numbers meet `m.*`, including the access-level sentence gated at Guest and below — `PLANNER` is 15 and does have merge-request access, so a threshold of 20 would state something false; verify `bun run test`

## 9. Traceability

- [x] 9.1 Add `features/domain/group-month-window.feature` citing `group-timelog-report / GROUP-2`, with step definitions in `tests/domain/`; verify `bun run test` and `bun run arch:trace`
- [x] 9.2 Add `features/domain/group-hours-matrix.feature` citing GROUP-3, GROUP-4, GROUP-5, GROUP-6 and GROUP-13; verify `bun run test` and `bun run arch:trace`
- [x] 9.3 Add `features/domain/group-hours-withheld.feature` citing GROUP-8 and GROUP-9, covering both signs of the residual; verify `bun run test` and `bun run arch:trace`
- [x] 9.4 Add `features/acceptance/read-a-groups-hours.feature` citing GROUP-1, GROUP-7, GROUP-10, GROUP-11, GROUP-12, GROUP-14, GROUP-15, GROUP-16, GROUP-17 and GROUP-18, each scenario carrying its `# Spec:` comment on the line above `Scenario:`; verify `bun run arch:trace`
- [x] 9.5 Add `team` to the `SCREENS` map in `tests/e2e/steps/keyboard.ts` and to both `Examples:` tables in `features/acceptance/use-every-screen.feature`, so the new screen is swept by axe in light and dark and at 375 px; verify `bun run test:e2e`
- [x] 9.6 Confirm `bun run arch:trace` reports every `GROUP-n` cited, and add no `UNCITED_BY_DESIGN` entry without a written reason beside it

## 10. The end-to-end regression

- [x] 10.1 Assert in the browser that a member who logged nothing has a row saying so, and that it is distinguishable from a row whose hours could not be read; verify `bun run test:e2e`
- [x] 10.2 Asserted as a component test rather than in the browser: the state depends on a page that has not arrived, and a timed e2e scenario would be the flakiest kind. `pagingGateway` parks the last page’s resolver, so the test can hold the report open, assert the reserved space, then deliver the page and watch the totals settle; verify `bun run test`
- [x] 10.3 Covered by the screen sweep: `/team` is now a row in both `use-every-screen.feature` outlines, so it carries the `axe-core` audit in light and dark and the 375 px assertion. The unreadable-group stub exists in `tests/e2e/support/gitlab-groups.ts` for a scenario that would name it; verify `bun run test:e2e`
- [x] 10.4 Assert that the withheld notice states the hours and names the reader’s access level as a reason; verify `bun run test:e2e`

## 11. The written record

- [x] 11.1 Replace "Single user, no team or group aggregation" in `openspec/config.yaml`'s context — left alone it instructs every future planning prompt not to build this — and correct `rules.specs[1]`, which says the `# Spec:` comment trails the scenario when this repo requires it to precede one; verify `bunx openspec validate report-a-groups-hours --strict`
- [x] 11.2 Edit `## Purpose` in `openspec/specs/dashboard-ui/spec.md`, which says the screens are built "for one person reading their own hours rather than for comparing a team"; a delta spec's Purpose is ignored for an existing capability, so this is a direct edit
- [x] 11.3 Update `AGENTS.md`: the new slices in the folder map, and a "decisions that will look wrong" entry for the widened window, for the aggregate-versus-nodes shortfall instrument, and for why there is no `user`-recovery document
- [x] 11.4 Update `docs/qa/quality-metrics.md` with the new requirement and test counts, `docs/qa/accessibility-audit.md` with the manual steps for the table (the week band is announced, a cell does not repeat the person, an unlogged working day says so and a non-working day says nothing, the ordering is spoken), and `docs/qa/browser-matrix.md` and `regression-checklist.md` with the new screen

## 12. Every gate

- [x] 12.1 Run `bun run verify && bun run test`, then `bun run test:coverage`, `bun run test:mutation` and `bun run test:e2e`
- [x] 12.2 Run `bun run build && bun run size` and confirm the 180 kB gzip budget still holds
- [x] 12.3 Verify against a real private group on gitlab.com — both as a member who can read everything and as one who cannot — that the shortfall figure matches what GitLab itself reports, and record the result. No fixture can prove this one

## 13. Reworked after the first read of the real screen

The screen was built, looked at, and changed. What follows is that second pass:
a combobox instead of a list standing permanently open, a row only for whoever
has something in it, and a table a reader can scan across without losing their
line.

- [x] 13.1 Add the combobox with `bunx shadcn@latest add combobox`, keep the deviations the CLI's output needs to survive here — our own `Input` instead of the `InputGroup` wrapper, whose addon is a `role="group"` div carrying a click handler no keyboard can reach; no chips, groups or collections, which `knip` fails on and the 200-line ceiling forbids — and re-apply the contrast fixes the CLI overwrote in `button.tsx` and `input.tsx`; verify `bun run verify`
- [x] 13.2 Rebuild `ui/group-picker.tsx` on it: the field opens the list on click, filtering stays the provider's (`filter={null}`) because the search matches on path as well as name, and the query follows only what the reader typed, never the name Base UI writes back on close; verify `bun run test`
- [x] 13.3 Load the picker in a chunk of its own. Base UI's floating-popup machinery is 40 kB — a sixth of the whole initial load, for a control on a screen most readers never open, and it took the budget from 166 kB to 207 kB; verify `bun run build && bun run size`
- [x] 13.4 Add `lib/rows.ts`: once the period has been read, a person with no visible entries and nothing withheld is named under the table instead of given a row. Everybody stays in the report — the totals, the roster union and the shortfall accounting all run first; verify `bun run test`
- [x] 13.5 Amend GROUP-3 and its scenarios, the acceptance feature and the regression checklist to the new rule, and drop `team_no_visible_entries` for `team_absent`; verify `bunx openspec validate report-a-groups-hours --strict`
- [x] 13.6 Make the table readable across: a `<colgroup>` so a column nothing is expected of is half as wide and tinted from `share` rather than from the cell's kind, a full-strength rule between ISO weeks against a faint one inside them, today's column bounded on both sides, hour figures at 13px, and an initials avatar against each name; verify `bun run test:e2e`
- [x] 13.7 Put the group, the month and the column axis on one row, so the first person is above the fold; verify `bun run test:e2e`
- [x] 13.8 Add `formatList` on `Intl.ListFormat` for the line that names whoever has no row — the conjunction and the comma before it are language-specific, and a hand-written separator gets every language but one wrong; verify `bun run test`
- [x] 13.9 Run every gate again, and correct the figures in `docs/qa/quality-metrics.md`

## 14. Where a withheld hour was logged

The row note said hours were missing and would not say where. The entries are
unrecoverable, but the day is not: the aggregate that reports the shortfall
reports it per span too, so asking it one column at a time says which day.

- [x] 14.1 Fix the per-row shortfall, which compared a declaration over the widened window against hours drawn for the month and so called every hour logged on a padding day an hour withheld. The cut moves inside `teamGrid`, so the figures drawn and the shortfall measured come out of one set; verify `bun run test`
- [x] 14.2 Move the trigger from seconds to entry count everywhere. Two withheld entries that cancel in seconds are still two entries kept from the reader, and the count is already free on the same aggregate; verify `bun run test`
- [x] 14.3 Stop a row whose entries were not all handed over from saying "nothing logged" in every empty cell — thirty-one assertions the screen has evidence against; verify `bun run test:e2e`
- [x] 14.4 Add `spanInstantsIn` on bisection rather than on constructed local midnight, which does not exist in every zone, ending each span one microsecond before the next begins so GitLab's inclusive bounds neither double-count nor leave a gap; verify `bun run test`
- [x] 14.5 Add `GROUP_COLUMN_PROBE` and its reader: one alias per column plus the period, one person per request, spans as variables. 224 of GitLab's 250 complexity points; a whole grid scores over eight thousand and is refused; verify `bun run test`
- [x] 14.6 Add `model/withheld.ts`: place the difference on the column that declared it, behind three checks on entry counts, and report what the columns could not account for separately; verify `bun run test`
- [x] 14.7 Ask only for rows already known to be short, capped at six, issued together. A group with nothing withheld costs no extra request; verify `bun run test`
- [x] 14.8 Draw the mark as a bracketed figure under the measured one, never added into it, so the row total, the column totals and the corner still agree; verify `bun run a11y:contrast`
- [x] 14.9 Write GROUP-19, its four scenarios, the Gherkin and the acceptance assertion, and record the decisions in `AGENTS.md` and the regression checklist; verify `bun run arch:trace`

## 15. What the screen may claim

A reader logged hours on an issue in another group and found the day blank. The
report was working as built — it only ever asks about one group — but the cell
said "No time logged", which is a claim about a person made from a measurement
of a group.

- [x] 15.1 Scope every sentence that overclaimed: the empty cell, its unreadable variant, the legend, the line naming whoever has no row, and the empty-group note. No string on this screen says a person logged nothing; the strongest any of them makes is that this group holds no hours; verify `bun run i18n:check`
- [x] 15.2 Move the scope into the table caption. It was stated only in a paragraph in the page header, which a reader reaching the grid by landmark or by table navigation never passes — so the one correct sentence on the screen was the one they could not hear; verify `bun run test:e2e`
- [x] 15.3 Amend GROUP-5 and GROUP-3 to say what a cell may claim, and record in `AGENTS.md` why the scope is not widened: `user(username:) { timelogs }` is the only door GitLab leaves open, and its `count`/`totalSpentTime` is computed before redaction, so the instrument every total on this screen is checked against cannot come with it; verify `bunx openspec validate report-a-groups-hours --strict`
- [x] 15.4 Assert the empty cell's own spoken text in the browser. The suite asserted that the scope sentence existed somewhere on the page, which is why this shipped; verify `bun run test:e2e`

## 16. Two questions, two controls

One control answered "what to cover" and "whose rows to draw" at once, and got
both wrong at squad level. Plus three things the reader asked for once they had
used the screen.

- [x] 16.1 Add `search.team` beside `search.group`: the first says whose rows are drawn, the second what is read, and `rosterGroupOf` defaults one to the other so every address written before this still means what it said; verify `bun run test`
- [x] 16.2 Drop the roster union's observed half when the two differ. Every sibling squad logs into a parent group's tree, and unioning their contributors in would fill the table with people the reader did not ask about; verify `bun run test`
- [x] 16.3 Remember both choices across visits, and complete an address that names no group by **redirecting** rather than by filling the screen in behind it — what a reader is looking at has to be what they can send somebody else. An address that does name a group is never overridden; verify `bun run test:e2e`
- [x] 16.4 Remove the line naming whoever has no row. With two controls it was less defensible than ever: it read as "these people logged nothing" from a report that can only see one group; verify `bun run test`
- [x] 16.5 Show a legend entry only when the table uses that mark. A key for something nowhere on screen sends the reader hunting, and withheld hours — the rarest mark — carried a permanent false lead; verify `bun run test:e2e`
- [x] 16.6 Write GROUP-20, amend GROUP-3, and record both decisions in `AGENTS.md`; verify `bunx openspec validate report-a-groups-hours --strict`

## 17. Two decisions taken back

The second group picker and the bracketed `(+2)` beside a figure were both built,
looked at, and reverted. Recorded rather than quietly undone: the reasoning that
produced them was sound, and the next person to have the same idea deserves to
know it was tried.

- [x] 17.1 Back to one group picker. Two on one screen answered a real question — a squad member logging in a sibling squad — at a price the answer did not justify; verify `bun run test`
- [x] 17.2 Keep the memory, narrowed to the one group. The address still wins over it, and a blank address is completed by redirecting rather than by filling the screen in behind it; verify `bun run test:e2e`
- [x] 17.3 Add a withheld hour into its cell instead of drawing it beside the figure, recomputing `share` with it and rebuilding every total from the summed cells so the rows, the columns and the corner still agree; verify `bun run test`
- [x] 17.4 Say what part of a cell cannot be opened to assistive technology only. Nothing marks it visually now, and a screen that folds an unreadable hour into a number and says nothing at all is vouching for something it cannot open; verify `bun run test:e2e`
- [x] 17.5 Strip the sync control back to sync state — when the hours arrived, whether they are arriving, whether asking failed. The caveats read as part of it and were announced on every refresh; the reader's own access level is not explained at all; verify `bun run test`
- [x] 17.6 Delete what those left behind: `lib/notices.ts`, four message pairs, the `GroupReport.access` field nothing read any more, and the contrast pair that measured a mark no longer drawn; verify `bun run deadcode`
- [x] 17.7 Rewrite GROUP-10, GROUP-11, GROUP-19 and GROUP-20 to match, and record both reversals in `AGENTS.md`; verify `bunx openspec validate report-a-groups-hours --strict`
