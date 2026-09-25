# Measure a team against the reader's schedule

## Why

GROUP-11 measures every bar on the team screen against a constant — eight hours
Monday to Friday, nothing at the weekend — and tints a column exactly when that
constant expects nothing of it. The constant was chosen so the screen would not
assert anything about a colleague's working arrangement it had no basis for.

The reader has that basis, and has already written it down. "Working hours" in
Settings is where they say how many hours a full day is, per weekday, and it is
the same person who picks which colleagues are on a team. A lead whose squad
works a six-hour Friday, or who covers Saturdays, reads a table that disagrees
with the schedule they configured one screen away: a Saturday of four hours drawn
as a quiet, narrow "nothing expected" column, and every Friday drawn as short.

## What changes

- The reference a team's cells are measured against is the reader's own daily
  target from Settings, per weekday, instead of the fixed eight-by-five.
- A column is tinted, narrowed and called "nothing expected" exactly when the
  reader's target for that weekday (or that week, under whole-week columns) is
  zero — not because it falls on a Saturday or a Sunday.
- The legend states that the bars are measured against the day's target,
  instead of naming a number of hours a day: a per-weekday schedule has no single
  number to name.
- The key's unnarrowed empty-day entry is shortened to "Nothing logged".
- Changing the target in Settings redraws the table; it asks the provider for
  nothing, because the reference is applied locally to entries already read.

## Impact

- Specs: `team-timelog-report` GROUP-11 is modified — the reference is the
  reader's configured daily target, and the screen says so.
- Code: `use-team-report.ts` passes `preferences.dailyTarget` as the grid's
  reference; `REFERENCE_SCHEDULE` leaves the entity and becomes a test fixture;
  the page and the legend stop carrying a single reference day.
- Messages: `team_reference_legend` rewritten, without its `{hours}` parameter;
  `team_legend_unlogged_anywhere` shortened.
- No change to what is read, to the query keys, or to what is persisted.
