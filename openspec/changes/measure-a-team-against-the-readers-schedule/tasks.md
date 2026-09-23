# Tasks

## 1. The rule

- [x] 1.1 GROUP-11 measures against the reader's daily target and says a column
      expects nothing exactly when that target is zero, with a scenario for a
      Saturday that has hours and a Wednesday that has none. Gate:
      `bunx openspec validate --strict`

## 2. The code

- [x] 2.1 `useTeamReport` passes `preferences.dailyTarget` as the reference and
      lists it in the memo's dependencies
- [x] 2.2 `REFERENCE_SCHEDULE` leaves the entity and its public API, and becomes
      a fixture in `tests/support/gitlab-team-timelogs.ts`. Gate: `bun run deadcode`
- [x] 2.3 The page stops computing `REFERENCE_DAY`; `MatrixLegend` loses its
      `reference` prop

## 3. The strings

- [x] 3.1 `team_reference_legend` says the bars are measured against the day's
      target, in both languages. Gate: `bun run i18n:check`
- [x] 3.2 `team_legend_unlogged_anywhere` is "Nothing logged" / "Sem
      lançamentos", and the acceptance step that reads it follows

## 4. The tests

- [x] 4.1 A component test: with a Saturday target and a Wednesday of zero, the
      Saturday column is a working column and the Wednesday column is tinted
- [x] 4.2 A component test: a bar is measured against the reader's target for
      that weekday, not against eight hours
- [x] 4.3 Every test that imported `REFERENCE_SCHEDULE` imports the fixture

## 5. The written record

- [x] 5.1 `AGENTS.md`, `README.md` and `docs/qa/regression-checklist.md`: the
      "stated constant" decision is rewritten, and the weekend-column decision
      says the tint follows the reader's schedule

## 6. Every gate

- [x] 6.1 `bun run verify && bun run test`
- [x] 6.2 `bun run test:e2e`
- [x] 6.3 `bunx openspec validate --all --strict`, then archive
