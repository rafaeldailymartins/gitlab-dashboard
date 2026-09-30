## MODIFIED Requirements

### Requirement: GROUP-1 — The report covers a team the reader defined, and says how far its figures reach

The report SHALL cover the time logged by the people one team names, over one
calendar month. How far that reach extends SHALL be the reader's choice, and
SHALL be stated where the figures are read.

With no group chosen the figures SHALL cover everywhere the provider counts —
every group, every project, personal projects, and work items belonging to no
project at all. That is a wider claim than this app has made before, and it is
what lets an empty cell be an answer rather than an absence of measurement.

With a group chosen the figures SHALL cover that group and its descendants and
nothing else. The screen SHALL name the group where the figures are read,
because a scoped figure and an unscoped one are drawn identically and differ only
in what they mean.

A group the provider will not resolve for the reader SHALL cost the report its
scope and not its figures: the figures SHALL fall back to the team's whole reach,
and the screen SHALL say that the scope was dropped. The answer this replaces was
a refusal with nothing on screen, which drew an unreadable scope exactly as it
would have drawn a readable group holding no hours — and those are different
facts, only one of which is about anybody's month.

With a group chosen a figure MAY include hours logged on work this account
cannot open, counted from what the provider declares about the person rather than
read from any entry, and the screen SHALL say so. The reach is no longer narrower
than the team's work; it is wider than the reader's own sight, and a reader who
took a total for something they could go and inspect would be wrong about it and
would not know.

With no group chosen those hours SHALL NOT be counted into any figure. They SHALL
be declared beside the row they belong to, as whatever difference they make to
its total in either direction — hours missing, or a figure that may be too high
where a withheld correction would have lowered it (GROUP-19
says why none is placed there), and the screen SHALL NOT claim that the figures
include work this account cannot open — a sentence saying they do, above figures
that do not, is the one statement on the screen a reader cannot check.

A team the app cannot read back SHALL be refused and named as such, never
presented as a team with no hours and never as an empty roster.

#### Scenario: A team the app cannot read back

- **WHEN** the reader's teams cannot be read
- **THEN** the screen says so
- **AND** no hours, no people and no totals are shown

#### Scenario: A group the reader may not read

- **WHEN** a reader opens a report scoped to a group the provider will not
  resolve for them
- **THEN** the figures are shown at the team's whole reach instead, and the
  screen says the scope was dropped
- **AND** the report is not refused, and no row is drawn as a month nobody worked

#### Scenario: The reach is stated, with no group chosen

- **WHEN** a report is shown for a team and no group is chosen
- **THEN** the screen states that the figures cover everywhere each person logged
- **AND** states that hours on work this account cannot open are not counted in,
  and that a row notes any difference they make to its total, in either
  direction

#### Scenario: The reach is stated, with a group chosen

- **WHEN** a report is shown for a team scoped to a group
- **THEN** the screen names that group where the figures are read
- **AND** states that the figures cover that group and its subgroups only
- **AND** states that they may include hours on work this account cannot open

### Requirement: GROUP-19 — Withheld hours are placed on the day they were logged

Where the provider will say so, a withheld hour SHALL be shown against the column
it was logged in rather than only against the person. The entries themselves are
unrecoverable — the provider removes the node, leaving no id and no date — so the
day SHALL be learned by asking the same aggregate over one column's span at a
time.

A placed hour SHALL be added into the figure for that column rather than drawn
beside it. The provider's own total for a day is the more useful answer to the
question this screen is opened with — did this person's day add up — and it is
the more correct one. Every total SHALL then be rebuilt from the summed figures,
so that a row total, a column total and the corner still agree with one another
and with the cells above them.

A cell holding hours the reader cannot open SHALL say so to assistive technology,
even though nothing marks it visually. A screen that folds an unreadable hour
into a number and says nothing at all is vouching for something it cannot open —
and the wider the reach, the more it is vouching for.

The spans SHALL be the exact instants each column opens and closes at in the
reader's own zone, one microsecond apart so that two adjacent spans neither share
an instant nor leave a gap between them. Asking SHALL be conditional on the row
already being known to be short by entry count, so a report in which nothing was
withheld costs nothing to produce.

Asking SHALL also be conditional on the report being narrowed to a group. At the
reader's whole reach almost every row is short — they are looking at colleagues'
working lives through their own permissions — so a shortfall there is the ordinary
condition rather than a finding. Marking a handful of rows while the rest keep the
note would put a difference on the screen that corresponds to nothing about the
data, and the handful is chosen by an identifier the reader never sees. The cost
is the provider's database, one request per row, on every report. Narrowed, the
reader has chosen a group they can mostly open, and a row short in it is worth
locating. Unnarrowed the row SHALL still say that hours are missing without saying
where — which is what it already says when a placement is refused, so the screen
gains no state the reader has to learn.

A placement SHALL be refused unless the columns account for the period exactly,
no column declares fewer entries than the reader was shown in it, and the period
declares at least what the row draws. A refused placement SHALL cost only its
marks: the row keeps saying that hours are missing without saying where.

What a row reports as missing SHALL be what the columns could not account for,
not the whole shortfall.

#### Scenario: Hours withheld on a known day

- **WHEN** the provider declares more hours in a column than it showed there
- **THEN** that cell shows the provider's total for the day, the difference
  included
- **AND** the row total, the column total and the corner are rebuilt from it

#### Scenario: A column set that does not cover the period

- **WHEN** the columns' declarations do not add up to the period's
- **THEN** nothing is placed, and the row reports the shortfall as before

#### Scenario: A day whose every entry was withheld

- **WHEN** the provider declares hours in a column and showed none of them
- **THEN** the cell shows them, and says aloud that none of them can be read

#### Scenario: A group with nothing withheld

- **WHEN** every row was shown as many entries as the provider counted
- **THEN** no column is asked about, and no extra request is made

### Requirement: GROUP-20 — The team is remembered between visits

The team the reader chose SHALL be remembered, so that opening the report again
does not begin by picking their own team out of a list.

An address that names a team SHALL NOT be overridden by what was remembered — a
link somebody sent outranks this reader's habit — and an address that names none
SHALL be completed with the remembered team by redirecting, so that what is on
screen is still what the address says. With nothing remembered, GROUP-14's
completion applies. Only the identifier is kept: GROUP-18 forbids writing hours or a
roster to a device that may be shared.

A remembered team that no longer exists SHALL be forgotten rather than shown as a
failure on arrival, wherever it was deleted — in the report's own dialog, from
Settings, or on another device. Otherwise deleting a team leaves every future
visit redirecting into a dead address. It SHALL be forgotten once the reader's
list is known and does not hold it, and the report SHALL then be completed as
GROUP-14 completes a bare address. An address that arrived naming a team the
reader never remembered is not this case, and still says there is no such team
of theirs.

The group the figures were scoped to SHALL NOT be remembered. The team has no
safe default and remembering it saves a choice the reader must make regardless;
the filter's default is the widest and most honest state, and remembering a
narrowing would make every later visit show less than the screen's own reach
sentence prepares the reader for — silently, and in the one direction that
understates a colleague's month.

#### Scenario: Coming back

- **WHEN** the reader opens the report with no team in the address
- **AND** they chose one on an earlier visit
- **THEN** the address is completed with it, and the screen matches the address

#### Scenario: A remembered team that was deleted

- **WHEN** the reader opens the report with no team in the address
- **AND** the team they chose last has been deleted
- **THEN** the report is about a team they still have, or invites them to make
  one, and reports no error
- **AND** the next visit with no team in the address does the same

#### Scenario: A scope is not carried into the next visit

- **WHEN** the reader scopes a report to a group
- **AND** later opens the report with no group in the address
- **THEN** the report is unscoped

### Requirement: GROUP-12 — The columns are days or whole weeks, at the reader's choice

The reader SHALL be able to switch the column axis between the days of the month
and its ISO weeks, and the choice SHALL travel in the report's address.

A week column SHALL show the hours logged in that week.

#### Scenario: Switching to weeks

- **WHEN** the reader switches the columns to weeks
- **THEN** each column is one ISO week of the month and shows that week's hours

#### Scenario: The choice is in the address

- **WHEN** the reader switches the columns and reloads the address they are on
- **THEN** the same column axis is shown

### Requirement: GROUP-14 — The report is addressable

The team and the month SHALL travel in the address, so a reader can send someone
else the exact report they are looking at. The team SHALL travel as its own
identifier rather than as its name, so that renaming a team does not change what
an address to it means.

The group the figures are scoped to SHALL travel in the address with them. It
changes every figure on the screen and changes nothing about how the screen
looks, so a link that dropped it would send a report that is not the one being
looked at, and the recipient would have no way to tell.

An address naming no team SHALL be completed with a team the reader has, and
SHALL invite them to make one where they have none. This is stated as completion
rather than as asking them to choose, because asking is not what the screen does:
a reader with teams and a bare address is shown their first one. The two readings
disagreed in the one case that matters — the visit right after a first team is
made — and the screen was right.

An address naming a team that is not this reader's SHALL say there is no such
team of theirs and show no figures — not an error about permission, which would
confirm that somebody else's team exists.

**That claim SHALL NOT be made about a team the reader has just deleted
themselves.** A save that leaves the addressed team no longer in the reader's
list SHALL move the address to one that is. "This is not one of your teams" is
a fact about an address that arrived naming somebody else's; said back to a
reader about the team they removed a moment ago, it reports their own action to
them as a mistake, and it leaves the control that names the team showing nothing
at all. The team the address moves to SHALL be read from what was stored, never
from what the surface was about to store: an edit that the rules refuse — a list
already at its ceiling, an identifier already used — leaves the save successful
and the team absent, and an address pointed at it would name nothing.

An address naming a group the reader cannot read SHALL fall back to the unscoped
report and say that it did, rather than showing an empty one: an empty scoped
report and an unreadable scope are different facts. An address whose month cannot
be read SHALL be recovered from rather than crashing the screen.

#### Scenario: Opening a shared address

- **WHEN** a reader opens an address naming a team and a month
- **THEN** the report for that team and that month is shown

#### Scenario: Moving to another month

- **WHEN** the reader moves to the previous month
- **THEN** the address changes to that month and the report is shown for it

#### Scenario: A scoped report is the report you can send

- **WHEN** the reader scopes the report to a group and opens the address they are
  on
- **THEN** the same group is chosen and the same figures are shown

#### Scenario: An address that names no group

- **WHEN** the reader opens the report's address with no team named
- **THEN** the screen shows a team they have, and reports no error

#### Scenario: A reader with no teams at all

- **WHEN** a reader who has made no team opens the report
- **THEN** the screen invites them to make one, and reports no error

#### Scenario: An address naming a team this reader does not have

- **WHEN** the reader opens an address naming a team that is not one of theirs
- **THEN** the screen says there is no such team of theirs, and shows no figures

#### Scenario: Deleting the team the address names

- **WHEN** the reader deletes the team the report is about and saves
- **THEN** the report is about a team they still have, and the control naming it
  says which

#### Scenario: A first team made from an address that named another

- **WHEN** a reader whose address names a team they no longer have makes a team
  and saves
- **THEN** the report is about the team they made, and the control naming it says
  which

#### Scenario: An address naming a group the reader cannot read

- **WHEN** the reader opens an address scoped to a group they cannot read
- **THEN** the unscoped report is shown, and the screen says the scope was
  dropped

#### Scenario: An address that cannot be read

- **WHEN** the reader opens the report's address with a month that is not a real
  month
- **THEN** the screen recovers to a month it can show, rather than failing

### Requirement: GROUP-17 — Every cell is reachable and understandable through its headings

The report SHALL be built as a table whose cells are associated with a heading
naming the person and a heading naming the day, so assistive technology announces
both when moving between cells without the cell repeating either of them.

No data cell SHALL be a keyboard stop. A month of cells for a whole team is
hundreds of cells, and making each one a stop would put the rest of the screen out
of practical reach.

#### Scenario: Reading a cell with assistive technology

- **WHEN** assistive technology moves across a row of the report
- **THEN** each cell is announced with the day it belongs to and the hours it
  holds, without repeating the person's name

#### Scenario: Moving through the screen by keyboard

- **WHEN** the reader moves through the screen using only the keyboard
- **THEN** the controls, the region holding the table and the orderable headings
  are reachable
- **AND** no individual cell, and no person's name, is a stop
