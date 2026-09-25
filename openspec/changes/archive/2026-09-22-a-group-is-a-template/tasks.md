# Tasks

## 1. The rules

- [x] 1.1 GROUP-15 drops "the window SHALL be stated" and "where the group could
      not be read to exhaustion the screen SHALL say so", with the two scenarios
      that covered them. Gate: `bunx openspec validate --strict`

## 2. The strings

- [x] 2.1 `teams_start_description` says what a group is for; `teams_description`
      says what a team is for; `teams_group_incomplete` is deleted. Gate:
      `bun run i18n:check`

## 3. The code that carried them

- [x] 3.1 `Seeding` answers with members alone — no `since`, no `partial`; the
      reason `partial` stops there is written in the hook. Gate: `bun run deadcode`
- [x] 3.2 `ManagerState` loses `incomplete`; the dialog's footer carries the save
      notice and nothing else
- [x] 3.3 `TeamStarter` loses the window and the locale it was formatted in

## 4. The tests that held them

- [x] 4.1 Drop the component test for the incompleteness notice and the
      acceptance scenario for the window, with its step. Gate: `bun run arch:trace`

## 5. The written record

- [x] 5.1 `AGENTS.md` and `docs/qa/accessibility-audit.md` stop saying the window
      is stated

## 6. Every gate

- [x] 6.1 `bun run verify && bun run test`
- [x] 6.2 `bun run test:coverage`, `bun run test:e2e`
- [x] 6.3 `bun run build && bun run size`
- [x] 6.4 `bunx openspec validate --all --strict`, then archive
