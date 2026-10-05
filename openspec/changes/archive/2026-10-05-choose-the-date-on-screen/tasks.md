# Tasks

## 1. The rule, before anything carries it

- [x] 1.1 `entities/timelogs/model/periods.ts`, test-first: `periodsOf(day)`
      names the day, its Monday-to-Sunday week and its calendar month, and
      `periodSummaries` says whether a report has read back past both. Domain
      scenarios for the periods of a chosen day and for the week that began in
      the previous month. Gates: `bun run test:coverage` (100% on `model/`),
      `bun run test:mutation`
- [x] 1.2 No new date arithmetic: stepping a month is `startOfMonth` and
      `addDays` from `shared/lib/date.ts`, which already exist. Planned as an
      `addMonths`, dropped as unnecessary

## 2. The report

- [x] 2.1 `useHoursReport(day)` summarises and settles the periods of the day it
      is given, defaulting to today. Gate: `bun run test`
- [x] 2.2 The day screen passes its own date, and waits for it to be settled.
      Gate: `bun run test`

## 3. The addresses

- [x] 3.1 `shared/lib/address.ts`: a day and a month made safe, never throwing,
      absence kept as absence. Gate: `bun run test`. Written first beside the
      pages, and moved: see 8.2
- [x] 3.2 The two routes validate their search and hand the page the choice and
      the way to change it. Gate: `bun run typecheck`

## 4. The screens

- [x] 4.1 The dashboard's day control, its period labels, the week strip of the
      chosen week, and the feed beginning at the chosen day
- [x] 4.2 Insights' month control, and the month shown as loading until settled
- [x] 4.3 Every new string in `messages/en.json` and `messages/pt-BR.json`, and
      the three that said "today" or "yet" about a day that may not be today.
      Gate: `bun run i18n:check`

## 5. Tests

- [x] 5.1 Component tests for both screens: choosing, stepping, going back,
      clamping, the feed's start, loading rather than zero, and a typed year
      committing once rather than once per segment
- [x] 5.2 Acceptance: `features/acceptance/choose-the-date.feature`, every
      scenario citing UI-17, UI-18 or UI-8. Gates: `bun run arch:trace`,
      `bun run test:e2e`

## 6. The written record

- [x] 6.1 `AGENTS.md`: why absence is not redirected, why the field waits, why
      the week is settled as well as the month
- [x] 6.2 `README.md` and `README.pt-BR.md` with their screenshots, and
      `docs/qa/regression-checklist.md`

## 7. Every gate

- [x] 7.1 `bun run verify && bun run test`
- [x] 7.2 `bun run test:coverage`, `bun run test:mutation`, `bun run test:e2e`
- [x] 7.3 `bun run build && bun run size`
- [x] 7.4 `bunx openspec validate --all --strict`

## 8. What the run found

- [x] 8.1 The keyboard sweep reached a stop with no focus ring: Chromium makes
      the calendar button inside a date input its own tab stop, and while it
      holds focus the input matches neither `:focus` nor `:focus-visible`. The
      ring is drawn on `:focus-within`, which matches on every stop. Moot
      since 9.1: the native field is gone.
- [x] 8.2 `bun run size` measured the initial load at 200.69 kB against a 180 kB
      budget, from 178.19 kB on `staging`. The routes imported their search
      parsers from the pages' public APIs, and a route's `validateSearch` is not
      code-split, so both pages came into the entry with them. The parsers
      moved to `shared/lib/address.ts`: 178.62 kB.

## 9. What review asked for

- [x] 9.1 The dashboard's day is picked from a calendar popover in the app's own
      style rather than the platform's date input, which wrote the date in the
      browser's locale and drew an operating-system control among the app's.
      `shared/ui/calendar.tsx` and `shared/ui/popover.tsx` from the shadcn CLI,
      corrected and recorded in place; `@daypicker/react` the one new
      dependency; the picker `lazy()` behind a skeleton of its own size. The
      debounce the native field needed went with it. Gates: `bun run test`,
      `bun run test:e2e` (a scenario picks yesterday from the calendar),
      `bun run size` (179.52 kB of 180 kB), `bun run security:audit`
- [x] 9.2 The way back on insights reads "Back to the current month" / "Voltar
      para o mês atual". Gate: `bun run i18n:check`
- [x] 9.3 The audit is two tiers (`scripts/check-audit.ts`): `bun audit --prod`
      at zero with no exceptions, and the tooling tree at zero unless
      `scripts/audit/accepted.ts` accounts for an advisory with no fixed release
      and no path to a reader. It went red on `braces` (GHSA-vfj7-8cjw-p6xm)
      mid-change, with no release to move to. Stale and overdue entries fail,
      and so does a production run that stops filtering. Checked by hand that
      each of those fails. Gate: `bun run security:audit`
