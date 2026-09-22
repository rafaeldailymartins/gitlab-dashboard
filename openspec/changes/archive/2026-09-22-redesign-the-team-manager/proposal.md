# Redesign the team manager

## Why

The teams surface shipped as a screen at `/teams`: a heading, a row of toggle
buttons, and three stacked sections of form controls. It works and it is
unpresentable. The lead who uses this app said so directly — it does not look
like a professional system — and on a product whose whole job is to be read by
somebody's manager, that is a defect and not a preference.

Three specific failures sit underneath the general one.

**Leaving the report to build a team breaks the task.** A reader notices a
missing colleague _while reading the month_. Today that costs them the screen
they were on, an unrelated page load, and the trip back. The teams surface has no
address worth sending anybody — it is this reader's own private list — so the
only thing the navigation bought was the interruption.

**Seeding was built as a control when it should have been an action.** The editor
carries a combobox labelled "Group to suggest from", after which the reader
clicks a plus beside each person, one at a time, with a write per click. The
thing a lead actually wants is _this squad, as a team, now_. The group is how a
team is born, not a filter that lives in the editor forever.

**It is slow, and the slowness is in the shape.** Suggestions read a group's
timelogs over ninety days, up to ten pages, strictly sequentially because each
page needs the previous cursor. The answer wanted is a set of perhaps a dozen
people; the read is up to a thousand entries to find them, and nothing appears
until the last page lands.

## What changes

- **The teams surface becomes a dialog**, opened from the report and from
  settings, and the `/teams` route is removed. The report stays underneath it.
- **A team is created from a GitLab group in one action.** Choosing a group mints
  the team, names it after the group, and puts everyone who logged hours there in
  the window on it — in a single save. "Start blank" is the other way.
- **The group control leaves the editor.** What remains is the team's name, its
  people, a search that finds anybody, and one button that reopens the group list
  to merge more people in.
- **The suggestion window narrows from ninety days to thirty**, and the read is
  capped at four pages rather than ten.
- **The report's controls become one toolbar** of equally sized, equally
  bordered controls, with the way into the teams dialog as an icon button beside
  the team it acts on — not an underlined text link at the end of the row.

## Impact

- Specs: `saved-teams` TEAM-1, `team-timelog-report` GROUP-15.
- Code: `src/pages/teams/` moves to `src/widgets/team-manager/`;
  `src/shared/ui/dialog.tsx` is added; `src/app/routes/_authenticated.teams.tsx`
  is removed; the report's control row and the settings card are rewritten.
- Tests: the acceptance steps open a dialog rather than navigate; the screen
  sweeps reach it the same way.
- No change to the endpoint, the stored document, the credential rules, or any
  figure on the report.
