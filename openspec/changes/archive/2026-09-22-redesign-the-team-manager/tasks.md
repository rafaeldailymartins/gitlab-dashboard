# Tasks

## 1. The dialog primitive

- [x] 1.1 Restore `src/shared/ui/button.tsx` from git — `shadcn add dialog`
      overwrote it and dropped four measured contrast fixes. Gate:
      `bun run a11y:contrast`
- [x] 1.2 Rewrite `src/shared/ui/dialog.tsx`: `cn` from `@/shared/lib/utils`, the
      close label from Paraglide, a backdrop that dims, no default width. Remove
      the `cn` package the generator installed. Gates: `bun run lint`,
      `bun run deadcode`, `bun audit`

## 2. The model: adding several people at once

- [x] 2.1 `withMembers(team, members, at)` in `entities/teams/model/edits.ts`,
      test-first: adds the ones who are not there, keeps the ones who are, stops
      at the ceiling, and returns the same team when nothing changed. Gates:
      `bun run test`, `bun run test:coverage` (100% on `model/`),
      `bun run test:mutation`

## 3. Faster suggestions

- [x] 3.1 `WINDOW_DAYS` 90 → 30 in `use-suggestions.ts`; `MAX_PAGES` 10 → 4 in
      `suggestion-reader.ts`, with the reason in place. Gate: `bun run test`

## 4. The team manager, as a dialog

- [x] 4.1 Move `src/pages/teams/` to `src/widgets/team-manager/`, exporting
      `TeamManagerDialog`. Gates: `bun run arch:layers`, `bun run arch:graph`
- [x] 4.2 Rewrite the layout: a dialog with the team list in a rail and the
      chosen team beside it, stacking at 375 px
- [x] 4.3 `TeamStarter` — the group list that mints a filled team, and "start
      blank". Delete the editor's group combobox
- [x] 4.4 `Add from a group` in the editor, merging without removing
- [x] 4.5 Delete `src/app/routes/_authenticated.teams.tsx`; open the dialog from
      the report and from the settings card instead. Gate: `bun run deadcode`

## 5. The report's controls

- [x] 5.1 One toolbar: `h-9` throughout, `border-input` throughout, names on the
      controls rather than above them, the teams button attached to the team
      control. Gates: `bun run lint:a11y`, `bun run a11y:contrast`

## 6. Strings

- [x] 6.1 New and reworded messages in `messages/{en,pt-BR}.json`; delete the
      ones the group combobox owned. Gate: `bun run i18n:check`

## 7. Tests

- [x] 7.1 Component tests for the dialog, the starter and the merge
- [x] 7.2 Acceptance steps open the dialog instead of navigating; `SCREENS` opens
      it for the a11y and 375 px sweeps
- [x] 7.3 New scenarios for the two new requirements' scenarios. Gate:
      `bun run arch:trace`

## 8. The written record

- [x] 8.1 `AGENTS.md`: the teams surface is a dialog, the group is a creation
      action, the window is thirty days — each replacing the decision it reverses
- [x] 8.2 `docs/qa/quality-metrics.md` requirement count if it moved

## 9. Every gate

- [x] 9.1 `bun run verify && bun run test`
- [x] 9.2 `bun run test:coverage`, `bun run test:mutation`
- [x] 9.3 `bun run test:e2e`
- [x] 9.4 `bun run build && bun run size`, and `dist/_headers` still reads
      `connect-src 'self' https://gitlab.com`
- [x] 9.5 `bunx openspec validate --all --strict`, then archive
