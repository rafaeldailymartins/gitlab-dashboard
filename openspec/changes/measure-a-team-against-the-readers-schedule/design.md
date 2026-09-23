# Design

## What the constant was protecting against, and why it no longer applies

`REFERENCE_SCHEDULE` was chosen over the reader's `dailyTarget` so that a
part-time teammate would not be drawn as short every day on the strength of the
_reader's_ contract. That argument assumed the reader's target describes the
reader alone. It does not, in practice: the person who opens the team screen is
the person who leads that team, and the schedule under "Working hours" is the
one statement anywhere in this app of what a full day is where they work. The
constant replaced it with a schedule nobody chose, which is the stronger claim
about somebody else's arrangement, not the weaker one.

What still holds is the half of the rule that was about honesty: the reference
is stated. The legend no longer names a number of hours — a per-weekday schedule
has none — but says each bar is measured against the day's target, in the words
Settings and the dashboard already use for the reader's own daily target.

The key's entry for an empty working day, unnarrowed, is shortened to "Nothing
logged" at the reader's request. The cells still say "No hours logged anywhere."
to assistive technology, and the narrowed entry still says "in this group", so
the key never makes the wider claim under a narrowed report.

## Where the change lives

The model never knew the constant was a constant. `teamGrid`, `columnsOf` and
`withWithheld` already take a `ReferenceSchedule` and derive `referenceHours`,
`share` and the `non-working` kind from it; the tint, the narrow `w-11` column
and the legend's "nothing expected" entry are all read from `referenceHours === 0`
or `share === null`. So the whole behavioural change is one argument in
`useTeamReport`: `preferences.dailyTarget` in place of `REFERENCE_SCHEDULE`, with
the target added to the memo's dependencies so that editing Settings redraws the
table.

`DailyTarget` and `ReferenceSchedule` are the same shape —
`Readonly<Record<Weekday, number>>` — and the page is where the two slices meet,
so no entity imports the other. `ReferenceSchedule` stays the model's own name
for it: the model is about a schedule measured against, not about preferences.

## What is deliberately not changed

- **The query keys.** The reference is applied after the entries are read, so a
  changed target reuses the cached month. Putting it in a key would refetch a
  whole team from GitLab to redraw bars.
- **`persist: false`.** Nothing new is read or kept.
- **The bars' geometry and the over-the-reference rule.** Same dashed rule, same
  overflow segment, same reason it is not a colour.

## The constant

`REFERENCE_SCHEDULE` leaves `entities/team-timelogs` — nothing shipped reads it
any more, and knip would say so — and moves to
`tests/support/gitlab-team-timelogs.ts` as the schedule the rules are exercised
against, under a name that says what it is rather than what it used to be for.
