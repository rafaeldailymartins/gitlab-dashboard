## 1. The caption says what the figures are (GROUP-1)

- [ ] 1.1 Reword `team_table_caption_everywhere` in `messages/en.json` and `messages/pt-BR.json` so it no longer claims the unnarrowed figures include work this account cannot open, and says a row states how many hours are missing; verify with `bun run i18n:check`
- [ ] 1.2 Move the "may include hours on work this account cannot open" step in `features/acceptance/read-a-teams-hours.feature` from the unnarrowed reach scenario to the narrowed one, add the unnarrowed "not counted in" step, and update `tests/e2e/steps/team-reach.ts`; verify the reach scenarios pass under `bun run test:e2e`

## 2. A dead remembered team is forgotten (GROUP-20)

- [ ] 2.1 Add a pure helper in `pages/team-hours/lib/` deciding whether the addressed team is a remembered one that the loaded list no longer holds, with a unit test covering: remembered and gone, remembered and present, gone but not remembered (a sent link), list still loading, list failed; verify the test passes
- [ ] 2.2 In `TeamHoursPage`, when the helper says so, move the address to `team: ''` through `onChange` with history replaced, so the route forgets the identifier and the bare address completes; verify with a component test that the page lands on the first team and that the remembered key is gone
- [ ] 2.3 Add the acceptance scenario "A remembered team that was deleted", citing `# Spec: team-timelog-report / GROUP-20`, with its steps; verify it passes and that `bun run arch:trace` is green

## 3. The reconnect notice offers what it says (AUTH-11)

- [ ] 3.1 Add one message for the reconnect control in both catalogues, and render a button calling `signIn` with the current href in the team report's reconnect note and in the teams dialog's; verify with component tests that each note has the button and that pressing it asks to sign in with the current address as the destination
- [ ] 3.2 Make the step behind "offers a fresh sign-in" in `features/acceptance/keep-a-team.feature` assert the button by role and name, not only the sentence; verify the scenario passes

## 4. A row is final on its own completeness (GROUP-7)

- [ ] 4.1 Carry each person's own `settled` from `windowsOf` in `entities/team-timelogs/model/report.ts` onto `GridRow` in `model/grid.ts` — from the window's settledness, never from `loadedThrough === period.to`, which a padding-day entry can satisfy while the window is still open — with a domain scenario in `features/domain/team-hours-matrix.feature` asserting one person's row total is final while another's is pending; verify with `bun run test` and 100% coverage on `model/`
- [ ] 4.2 In `pages/team-hours/ui/matrix-row.tsx`, gate the row total, its skeleton, its caveat and `withheld` on the row's own `settled` instead of the report's `complete`, and stop passing `complete` to rows from `team-matrix.tsx`; `MatrixFoot` keeps `complete`; verify with a component test that a finished row shows its total while another row is still reading

## 5. The living specs

- [ ] 5.1 Validate the change with `bunx openspec validate reconcile-specs-with-the-code --strict` and verify it passes
- [ ] 5.2 After implementation, archive the change so `openspec/specs/` carries the deltas; verify `bunx openspec validate --all` passes and `bun run arch:trace` is green

## 6. Gates

- [ ] 6.1 Run `bun run verify && bun run test` and verify both exit 0
