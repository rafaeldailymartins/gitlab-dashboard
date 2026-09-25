# A group is a template, not a census

## Why

GROUP-15 requires two sentences on screen that made sense while a group seeded a
_list of candidates_ and stopped making sense when it started making the team.

**The window.** "People who logged time there since 23 August 2026." That
mattered when the reader was picking names out of a list: the window was the
difference between "nobody logged here" and "nobody logged here lately", and a
reader who was not told it could not tell an absence from a holiday. A group is
now a template — one click and the reader is looking at the team itself, with
every one of those people on it and a search that reaches anybody who is not. The
sentence spends the one line the starter has explaining the provider's paging
instead of telling the reader what the control does.

**The incompleteness notice.** "That group has more entries than were read, so
these may not be everybody." The same reversal: a census that might be short is a
serious claim about a list that _is_ the answer, and a mild one about a starting
point being edited in front of you. It also fires on exactly the groups where the
reader can see for themselves that somebody is missing.

Neither rule was wrong. Both were about a surface that no longer exists.

## What changes

- The starter says what a group is for — a template, changeable afterwards — and
  no longer states the thirty-day window.
- The incompleteness notice is removed, with the message it used.
- The window is still thirty days and the read still stops at four pages. The
  adapter still reports whether it was exhausted, and is still tested on it.
- The dialog's own description says what a team is for, in the reader's terms.

## Impact

- Specs: `team-timelog-report` GROUP-15 loses two requirements and the two
  scenarios that covered them.
- Code: `use-group-seeding.ts` stops carrying `since` and `partial` to the
  interface; `use-manager-state.ts` loses `incomplete`; the starter and the
  dialog's footer lose a line each.
- Messages: `teams_group_incomplete` deleted, `teams_start_description` and
  `teams_description` rewritten.
- No change to what is read, to how far back, or to who ends up on a team.
