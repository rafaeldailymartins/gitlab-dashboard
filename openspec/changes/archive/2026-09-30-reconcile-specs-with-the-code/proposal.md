## Why

A sweep of the documentation against the code, with every finding checked a
second time before anything was changed, found the living specs saying things
the code deliberately does not do, and two clauses whose tasks were ticked in an
archived change while nothing implemented them. A spec that disagrees with the
screen is worse than no spec: `arch:trace` matches requirement ids, not
behaviour, so both kinds of gap passed every gate.

## What Changes

- **GROUP-1**: unnarrowed, hours on work the reader cannot open are declared
  beside the row, not counted into it — which is what the code has done since
  placement was limited to a narrowed report. The requirement said "in either
  state a figure MAY include" them, and the table's caption says flatly that the
  unnarrowed figures include them. The caption changes in both languages.
- **GROUP-19**: drop the sentence saying a placed hour may have been logged
  anywhere the provider counts. Placement only runs narrowed, so a placed hour is
  always inside the chosen group, and the same requirement already says so.
- **GROUP-20**: a bare address is completed with the _remembered_ team by
  redirecting; with nothing remembered, GROUP-14's completion applies. A
  remembered team that no longer exists is forgotten on arrival, wherever it was
  deleted — this clause was specified and never implemented, so deleting a team
  from Settings or another device left every later visit on "not one of your
  teams" with an empty picker. Its scenario's THEN, which contradicted GROUP-14,
  is corrected.
- **GROUP-12**: **remove** the clause that a week column shows how many of the
  week's expected days were logged. It was never built; the reader decided to
  drop it rather than build it.
- **GROUP-14**: the scenario "An address that names no group" is about a team,
  but it keeps its title. A MODIFIED block cannot rename a scenario — the CLI
  reads a renamed scenario as a dropped one and refuses it, deliberately — and
  the scenario's steps already say "no team", which is what a reader acts on.
- **GROUP-17**: a person's name is not a keyboard stop and never was; the
  scenario stops saying it is.
- **TEAM-1**: the scenario stops asking the reader to close a dialog that saving
  already closed. **TEAM-4**: closing on Save is the report that a change was
  saved; there is no "Saved." message.
- **UI-16**: the scenario's address names a team, not a group.
- **I18N-5**: a missing translation fails verification, not the build — Paraglide
  falls back to the base locale, and `i18n:check` in `verify` is what refuses it.
- **AUTH-11** (no requirement change): the notice on the team report and in the
  teams dialog tells the reader to sign in again and offers nothing to press. A
  control that re-authorizes and returns them where they were is added, and the
  acceptance step asserts the control rather than the sentence.

- **GROUP-7** (no requirement change): "a row SHALL be presented as final on its
  own completeness, not on the report's" — but every row's total, skeleton and
  caveat still wait on the whole team, as they did when one serial read made
  every row settle together. The per-person frontier moved the cells and left
  the rows behind. Each row now settles on its own.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `team-timelog-report`: GROUP-1, GROUP-12, GROUP-14, GROUP-17, GROUP-19,
  GROUP-20.
- `saved-teams`: TEAM-1, TEAM-4.
- `dashboard-ui`: UI-16.
- `localization`: I18N-5.

## Impact

- `pages/team-hours`: forgetting a dead remembered team on arrival, and a
  reconnect control on the report's notice.
- `widgets/team-manager`: the same reconnect control in the dialog's notice.
- `messages/{en,pt-BR}.json`: the unnarrowed caption, and one label for the
  reconnect control.
- `features/acceptance/read-a-teams-hours.feature`, `keep-a-team.feature` and
  their steps: a scenario for a deleted remembered team; the reach step moves to
  the narrowed scenario; the reconnect step asserts a button.
- No change to the endpoints, the stored documents or the queries.
