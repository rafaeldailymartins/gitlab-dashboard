# team-timelog-report Specification

## Purpose

Reading the hours logged by a team the reader keeps — a list of people they
chose, rather than a namespace somebody else administers — over one calendar
month, arranged per person and per day in the reader's own time zone. The rows
are that list exactly, so a row with nothing in it is the answer the reader came
for rather than an oversight to be tidied away.

How far the figures reach is theirs to narrow. Left alone they cover everywhere
the provider counts, personal projects included, which is what lets a cell say
that somebody logged nothing at all; narrowed to a group they cover that group
and its descendants, and the strongest thing a cell may then say is that the
group holds no hours for that day. The screen states which of the two it is,
where the figures are read.

Every figure carries how much of the truth the provider was willing to show the
reader, because a number beside a colleague's name is one somebody makes a
decision about. Entries the reader may not read are removed without an error and
without a gap, and still counted, so the difference between what was counted and
what arrived is the only instrument there is for saying that a month is short —
and, where the provider will answer one column at a time, which day it is short
on.

## Requirements

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

In either state a figure MAY include hours logged on work this account cannot
open, counted from what the provider declares about the person rather than read
from any entry. The screen SHALL say so. The reach is no longer narrower than
the team's work; it is wider than the reader's own sight, and a reader who took a
total for something they could go and inspect would be wrong about it and would
not know.

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
- **AND** states that they may include hours on work this account cannot open

#### Scenario: The reach is stated, with a group chosen

- **WHEN** a report is shown for a team scoped to a group
- **THEN** the screen names that group where the figures are read
- **AND** states that the figures cover that group and its subgroups only

### Requirement: GROUP-2 — A month is a month in the reader's time zone

The period SHALL be one calendar month bounded by the configured time zone, and
every entry SHALL be placed on the calendar day it falls on in that zone.

The provider filters by an instant range whose interpretation this app does not
control. The range asked for SHALL therefore be a superset of the reader's month
under every interpretation the provider could apply — exact instants, or a range
widened to whole calendar days in any offset — and the month SHALL then be cut
from the answer locally, in the reader's zone. A period asked of the provider and
trusted verbatim would disagree with the days on screen by the hours logged on
the boundary days.

#### Scenario: An entry near the start of the month

- **WHEN** an entry is logged at an instant that falls on the first day of the
  month in the configured time zone but on the last day of the previous month in
  UTC
- **THEN** it appears in the first day's column

#### Scenario: An entry just outside the month

- **WHEN** an entry is logged at an instant that falls on the last day of the
  previous month in the configured time zone
- **THEN** it appears nowhere in the report, in no cell and in no total

#### Scenario: Changing the time zone regroups the report

- **WHEN** the configured time zone changes to one whose offset moves an entry to
  another calendar day
- **THEN** that entry appears in the other day's column, without asking the
  provider again

### Requirement: GROUP-3 — Rows are the team, exactly

Rows SHALL be exactly the people the team names, and no others. The reader chose
each one, so a row with nothing in it is the answer they came for rather than
noise to be tidied away; and nobody the reader did not choose appears, however
much they logged.

No row SHALL be dropped for having no figures, at any point in the read. The
rule this replaces dropped whoever logged nothing once the month was read,
because the screen measured one namespace and an hour logged elsewhere was
invisible from it. The measurement is now the person, so an empty row is a claim
the screen has the evidence for — which is what makes it worth drawing.

Bots SHALL be left out of suggestions, never out of the report. A person on a
team stays on it until the reader takes them off.

Nobody SHALL be presented as having logged nothing while their month is still
being read: until then "logged nothing" is indistinguishable from "not read yet".

Row order SHALL be deterministic and SHALL NOT depend on the machine the report
is rendered on.

#### Scenario: A team member who logged nothing

- **WHEN** a person on the team logged no time in the month
- **AND** their month has been read in full
- **THEN** they have a row, whose cells say they logged nothing

#### Scenario: A team member whose month is still being read

- **WHEN** no entry has arrived yet for a person on the team
- **AND** their month has not been read in full
- **THEN** their row's cells are reserved space rather than figures
- **AND** nothing on the screen says they logged nothing

#### Scenario: A member whose hours were all withheld

- **WHEN** the provider counted hours for a person and handed none of them over
- **THEN** they have a row, which says the hours could not be read
- **AND** the row is not drawn as a month they did not work

#### Scenario: Somebody who is not on the team

- **WHEN** a person logged time on the same work and is not on the team
- **THEN** they have no row, and no total counts their hours

#### Scenario: A bot the reader put on the team

- **WHEN** the reader has put a bot on the team by name
- **THEN** it has a row like anybody else
- **AND** it is still left out of the suggestions, which nobody manages a
  timesheet for

### Requirement: GROUP-21 — A stored member the provider no longer recognises

A person on a team SHALL be drawn from what the reader last saw of them, so a
stored roster is never a blank screen.

A member SHALL be **asked about** by the stored user identifier, never by the
username. A username can be given up and taken by somebody else, and a roster
addressed by one could come to point at a stranger with nothing on screen to say
so. Asking by the identifier does not detect that case — it makes it
unexpressible, which is the stronger guarantee and the one this requires: the
provider resolves the node for the identifier it was given, or it resolves
nothing.

Where the provider will not resolve a stored member — the account is gone, or is
beyond this reader — the row SHALL say so, under the name the reader last saw.
It SHALL NOT be read as a person who logged nothing, and SHALL NOT contribute a
figure to any total: an absent answer is not an answer of zero, and every cell of
such a row SHALL say that nothing is known rather than that nothing was logged.

Where the provider resolves the stored identifier to a different username, the
row SHALL show what the provider now says. A rename is the reader's colleague
changing their handle, not an error, and nothing SHALL be said about it.

#### Scenario: A member the provider will not resolve

- **WHEN** the provider resolves nobody for a person on the team
- **THEN** their row is drawn under the name the reader last saw, and says the
  provider did not recognise them
- **AND** every cell of that row says nothing is known, not that nothing was
  logged
- **AND** no total counts a figure for them

#### Scenario: A member who changed their username

- **WHEN** the provider resolves a stored member's identifier to a different
  username
- **THEN** the row shows the new username, and draws their hours as usual
- **AND** nothing on the screen remarks on the change

### Requirement: GROUP-4 — A cell is one person on one calendar day

A cell SHALL hold the time that one person logged on one calendar day, summed in
seconds from every entry that falls there and converted to hours once.

A correcting entry SHALL be honoured rather than discarded: the provider records
a correction as a negative duration, and a day that holds an entry and its
correction is a day with entries and a total of nothing — which is not the same
fact as a day with no entries.

#### Scenario: Two entries on the same day

- **WHEN** a person logs time twice on the same calendar day
- **THEN** the cell for that person and that day shows the sum of both

#### Scenario: A day whose entries cancel out

- **WHEN** a person logs time and then logs a correction of the same size on the
  same calendar day
- **THEN** the cell shows no hours and is still counted as a day with entries,
  distinct from a day with none

### Requirement: GROUP-5 — A cell says which kind of nothing it is

An empty cell SHALL be distinguishable between five different facts, and SHALL
NOT collapse any two of them:

- a day on which the person logged nothing within the report's reach —
  everywhere the provider counts, or within the chosen group,
- a day on which nothing arrived and the screen has not established that nothing
  exists,
- a day on which nothing was expected,
- a day that has not happened yet,
- a day whose entries have not been read yet.

The distinction SHALL be carried by something other than colour alone.

A cell MAY state that a person logged nothing, and SHALL do so only where the
provider's own count for that person over that span is zero. That count is
computed before the provider removes what the reader may not read, so a zero is
the one figure on this screen that rules out an hour the reader cannot see.

What the cell may claim SHALL follow the reach. With no group chosen, a zero
count means the person logged nothing anywhere the provider counts, and the cell
SHALL say so — the strongest claim this capability has been able to make. With a
group chosen, a zero count means only that the group holds nothing for that day,
and the cell SHALL say that and no more: an hour logged on an issue in another
group is outside the question the reader asked, and a cell that forgot the
reader's own filter would report the filter's effect as the person's behaviour.
The two SHALL be different sentences, not one sentence with a footnote elsewhere
on the page.

Where a person's month is short by an entry count and no per-column answer
survived its checks, no empty cell of that row SHALL make either claim. The
strongest claim there is that nothing arrived for that day and that part of the
month could not be read. This case is orthogonal to the reach and SHALL be
distinguishable in both states.

The reach SHALL be stated where the figures are read, not only above them. A
reader who reaches the table by landmark or by table navigation never passes the
heading, so the table caption carries it — including which group, when one is
chosen.

#### Scenario: A day with an expectation and nothing logged

- **WHEN** a day in the past carries an expectation
- **AND** no group is chosen
- **AND** the provider counted no entries for that person over that day
- **THEN** the cell is marked as empty, and assistive technology says the person
  logged nothing that day

#### Scenario: A day with an expectation and nothing logged, within a chosen group

- **WHEN** a day in the past carries an expectation
- **AND** the report is scoped to a group
- **AND** the provider counted no entries for that person over that day in that
  group
- **THEN** the cell is marked as empty, and assistive technology says that the
  group holds no hours for it
- **AND** no cell says the person logged nothing

#### Scenario: A day in a month that could not be read in full

- **WHEN** the provider counted more entries for a person than it showed
- **AND** no per-column answer survived its checks
- **THEN** no empty cell of that row says the person logged nothing
- **AND** each says that nothing arrived for it and that part of the month could
  not be read

#### Scenario: A day with no expectation

- **WHEN** a day carries no expectation
- **THEN** the cell is marked as a day without expectation
- **AND** assistive technology says nothing about it beyond its column heading

#### Scenario: A day after today

- **WHEN** a day in the reported month is later than today
- **THEN** the cell is not marked as a day the person failed to log

### Requirement: GROUP-6 — Every total agrees with the cells it is made of

A row total, a column total and the grand total SHALL each be accumulated in
seconds from the entries themselves and converted to hours once, never summed
from figures already rounded for display.

The grand total SHALL equal the sum of the row totals and the sum of the column
totals, exactly.

#### Scenario: The three ways of adding up agree

- **WHEN** the grand total is compared with the sum of the row totals and with
  the sum of the column totals, in seconds
- **THEN** all three are equal

### Requirement: GROUP-7 — A figure beside a person's name is never a floor presented as an answer

While a person's month has not been read in full, the report SHALL NOT present
any figure of theirs as their total. Space SHALL be reserved for the figure
instead, so that arriving data does not move the page and no reader can mistake a
partial read for a person who logged nothing.

Because each person's month is read on its own, a row MAY be final while others
are not. A row SHALL be presented as final on its own completeness, not on the
report's.

An aggregate over the whole team MAY be shown before every person is read in
full, and SHALL then be marked as a floor rather than stated as the period's
total.

#### Scenario: A person whose hours arrive last

- **WHEN** a person's entries have not arrived yet
- **THEN** their row shows reserved space rather than a total, and no cell of
  theirs is marked as a day they failed to log

#### Scenario: One person's month is read before another's

- **WHEN** one person's month has been read in full and another's has not
- **THEN** the first person's total is presented as final
- **AND** the second person's row shows reserved space

#### Scenario: The group total before the period is read in full

- **WHEN** any person's month is still being read
- **THEN** the total over everyone is presented as a floor that may rise, not as
  the month's figure

#### Scenario: The period is read in full

- **WHEN** every entry in the period has been read
- **THEN** every figure is presented as final

### Requirement: GROUP-8 — The report states what it could not account for

The provider removes entries the reader is not allowed to read without reporting
an error and without leaving a gap, while separately reporting how many entries
exist over a span and how many seconds they hold. The report SHALL use that
difference, per person, rather than presenting what it received as everything
there is.

Where a difference has been placed on the days it belongs to, it SHALL NOT also
be reported as missing: it is in the figures. What SHALL be reported is what is
left — the part no span accounted for, and any difference that runs the other
way.

The difference SHALL be reported in whichever direction it falls. A difference
that means the figures on screen are too high SHALL NOT be reported as nothing
missing, because a withheld correction moves the figures the other way.

When nothing is left unaccounted for, the report SHALL say nothing about it
rather than showing an empty or zero notice.

#### Scenario: Entries the reader may not read

- **WHEN** the provider reports more entries for a person than it showed the
  reader
- **AND** no span accounted for the difference
- **THEN** the report states how many entries and how many hours are missing from
  that person's figures

#### Scenario: A difference that has been placed is not also reported as missing

- **WHEN** every entry the provider counted for a person has been placed on a day
- **THEN** that person's row reports nothing missing

#### Scenario: The figures are higher than the provider's own total

- **WHEN** the entries shown for a person hold more seconds than the provider
  reports for them
- **THEN** the report states that the figures may be too high, rather than
  stating that nothing is missing

#### Scenario: Nothing was withheld

- **WHEN** every entry the provider counted was also shown to the reader
- **THEN** the report says nothing about missing entries

### Requirement: GROUP-9 — A shortfall belongs to the row it came from

A shortfall SHALL be attributed to the person whose hours are short, not only to
the report. A row whose visible hours fall short of what the provider reports for
that person SHALL show the shortfall beside its total.

What the provider reports for that person SHALL be what it reports about the
person themselves, over the report's whole reach, rather than about their share
of one namespace. The wording of this requirement barely moves and its meaning
widens completely: the figure it compares against is now the person measured
against themselves.

A row whose entries the reader may not read at all SHALL be distinguishable from
a row belonging to a person who logged nothing. Those are opposite facts, and
presenting them the same way is the failure this requirement exists to prevent.
The distinction is no longer half-hypothetical: both sides are now claims the
screen has evidence for.

The comparison SHALL be made over one window. What the provider declares covers
the window it was asked about — the month widened by a day at each end — so what
it is compared against SHALL cover that same window, not the month drawn on
screen. A row that compared a declaration over the window against the hours drawn
for the month would report every hour anybody logged on a padding day as an hour
that had been withheld from the reader, which is both false and common: it needs
only somebody to log time on the last day of the month before.

#### Scenario: One person's entries are partly unreadable

- **WHEN** the provider reports more hours for a person than it showed the reader
- **THEN** that person's row shows its visible total and the shortfall beside it

#### Scenario: Hours logged just outside the month

- **WHEN** a person logged hours inside the widened window and outside the month
- **AND** the provider declared them
- **THEN** their row reports no shortfall, and draws no hours

#### Scenario: A person whose whole month is unreadable

- **WHEN** the provider reports hours for a person and showed the reader none of
  them
- **THEN** the row says the hours could not be read, not that the person logged
  nothing

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
and the wider the reach, the more it is vouching for. A placed hour may now have
been logged anywhere the provider counts rather than inside a namespace the
reader chose.

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

### Requirement: GROUP-10 — A caveat is said beside the figure it is about

What a figure could not include SHALL be said on the row or in the cell it
qualifies, and SHALL NOT be said in the control that reports when the hours
arrived. That control owns the screen's one status region and answers three
questions — when the hours came, whether they are coming now, whether asking
failed. A sentence about somebody's month appended to it is read as part of the
sync state, is announced on every refresh, and is nowhere near the number it is
about.

The report SHALL NOT explain the reader's own level of access to them. It is not
something the screen measured, it is the same on every visit, and it is not what
somebody opened a month of hours to find out.

#### Scenario: Hours are missing from a person's month

- **WHEN** the provider counted hours for a person that it did not hand over
- **THEN** the shortfall is stated on that person's row
- **AND** the sync control says only when the hours arrived

### Requirement: GROUP-11 — Hours are measured against a reference the screen states

A cell's hours SHALL be presented against a reference schedule, and the screen
SHALL state what that reference is. The app has no knowledge of any person's
working arrangement, so an unstated reference would make the report assert
something about a colleague's contract that it cannot know.

The comparison SHALL be carried by the length of a mark against a visible
reference point, and SHALL NOT depend on hue. Hours above the reference SHALL be
distinguishable from hours that exactly meet it.

#### Scenario: The reference is stated

- **WHEN** a report is shown
- **THEN** the screen states the reference the marks are measured against

The key SHALL list only the marks the table in front of the reader actually
uses. A key for something that is nowhere on screen sends them looking for it,
and finding nothing is indistinguishable from having missed it. The reference
itself is always listed, because it explains every figure there is.

#### Scenario: A day above the reference

- **WHEN** a person logs more hours on a day than the reference expects
- **THEN** the mark for that day is distinguishable from a day that exactly meets
  the reference, without relying on colour

#### Scenario: A report that uses none of a mark

- **WHEN** no cell in the table carries a given mark
- **THEN** the key does not explain it

### Requirement: GROUP-20 — The team is remembered between visits

The team the reader chose SHALL be remembered, so that opening the report again
does not begin by picking their own team out of a list.

An address that names a team SHALL NOT be overridden by what was remembered — a
link somebody sent outranks this reader's habit — and an address that names none
SHALL be completed by redirecting, so that what is on screen is still what the
address says. Only the identifier is kept: GROUP-18 forbids writing hours or a
roster to a device that may be shared.

A remembered team that no longer exists SHALL be forgotten rather than shown as a
failure on arrival. Otherwise deleting a team leaves every future visit
redirecting into a dead address.

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
- **THEN** they are asked to choose a team, and the address names none

#### Scenario: A scope is not carried into the next visit

- **WHEN** the reader scopes a report to a group
- **AND** later opens the report with no group in the address
- **THEN** the report is unscoped

### Requirement: GROUP-12 — The columns are days or whole weeks, at the reader's choice

The reader SHALL be able to switch the column axis between the days of the month
and its ISO weeks, and the choice SHALL travel in the report's address.

A week column SHALL show the hours logged in that week and how many of the week's
expected days were logged, so the weekly reading does not hide a week's worth of
hours logged on a single day.

#### Scenario: Switching to weeks

- **WHEN** the reader switches the columns to weeks
- **THEN** each column is one ISO week of the month and shows that week's hours
  and how many of its expected days were logged

#### Scenario: The choice is in the address

- **WHEN** the reader switches the columns and reloads the address they are on
- **THEN** the same column axis is shown

### Requirement: GROUP-13 — Days are grouped into ISO weeks

Day columns SHALL be grouped into bands, one per ISO week, each labelled with its
week number and the days of the month it spans.

A band SHALL be labelled with the ISO week-numbering year rather than the
calendar year, because the first days of January can belong to the last week of
the previous year.

#### Scenario: A month that starts mid-week

- **WHEN** the first day of the reported month is not a Monday
- **THEN** the first band spans only the days of that week that fall in the month
- **AND** it is labelled with the ISO week those days belong to

### Requirement: GROUP-14 — The report is addressable

The team and the month SHALL travel in the address, so a reader can send someone
else the exact report they are looking at. The team SHALL travel as its own
identifier rather than as its name, so that renaming a team does not change what
an address to it means.

The group the figures are scoped to SHALL travel in the address with them. It
changes every figure on the screen and changes nothing about how the screen
looks, so a link that dropped it would send a report that is not the one being
looked at, and the recipient would have no way to tell.

An address naming no team SHALL ask the reader to choose one rather than failing,
and SHALL invite them to make one where they have none. An address naming a team
that is not this reader's SHALL say there is no such team of theirs and show no
figures — not an error about permission, which would confirm that somebody else's
team exists. An address naming a group the reader cannot read SHALL fall back to
the unscoped report and say that it did, rather than showing an empty one: an
empty scoped report and an unreadable scope are different facts. An address whose
month cannot be read SHALL be recovered from rather than crashing the screen.

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
- **THEN** the screen asks them to choose a team, and reports no error

#### Scenario: A reader with no teams at all

- **WHEN** a reader who has made no team opens the report
- **THEN** the screen invites them to make one, and reports no error

#### Scenario: An address naming a team this reader does not have

- **WHEN** the reader opens an address naming a team that is not one of theirs
- **THEN** the screen says there is no such team of theirs, and shows no figures

#### Scenario: An address naming a group the reader cannot read

- **WHEN** the reader opens an address scoped to a group they cannot read
- **THEN** the report is shown unscoped, and the screen says the scope was
  dropped

#### Scenario: An address that cannot be read

- **WHEN** the reader opens the report's address with a month that is not a real
  month
- **THEN** the screen recovers to a month it can show, rather than failing

### Requirement: GROUP-15 — The reader can find the people they mean

The reader SHALL be able to put a person on a team by searching the provider for
them, and SHALL be able to build a team out of whoever logged time in a group
they are authorized in — including one they can read through membership of an
ancestor group rather than of the group itself.

A group SHALL be how a team is started, not a control that lives beside it. The
reader names a group once; the people that group's hours belong to arrive as the
team. Offering the group as a standing filter over a list of candidates asks the
reader to re-answer, one person at a time, a question they already answered by
naming the squad — and the same group SHALL remain reachable afterwards, as a way
to merge in whoever has appeared since, rather than as a control that is always
on screen.

A group is a **template**, and the screen SHALL say so rather than describing how
the provider was read. What the reader gets is a team they own from that moment,
which is why what they are told is that they can change who is on it. The window
the people were read over used to be stated here and is not any more: that
sentence was the difference between "nobody logged here" and "nobody logged here
lately" while the reader was picking names out of a list, and there is no such
list — one click later they are looking at the team, with everybody on it.

The seed is whoever logged, not whoever is a member. A group's membership is a
list of people with access, most of whom may never have touched time tracking;
the people a lead is building a report about are the people whose hours there are
to report. Reading them costs a paged read of the group's timelogs where a
membership list cost one cheap page, and that is the price of suggesting the
right people rather than everybody with a key.

That price SHALL be bounded, because it is paid while somebody waits. The window
is a trailing thirty days and the read stops after a small fixed number of pages.
People saturate long before entries do — a squad's month is hundreds of timelogs
and perhaps a dozen names — so reading further mostly buys the same names again,
and the reader is left looking at nothing while it happens.

Both bounds can leave somebody out, and what covers that is the search rather
than a sentence. A colleague the window missed, one the cap missed, and one who
has logged nothing anywhere are the same problem to the reader and have the same
fix: the search SHALL reach anybody the provider knows, logged or not, and SHALL
be on screen beside the team rather than behind a control.

A seeded team SHALL be a team and nothing more. The reader chooses who stays, and
the team SHALL NOT change afterwards because the group's contributors did. A
roster that followed a group would take a colleague off a lead's report the week
they moved team, and would silently remove their hours from every total in every
month already reported — including months they were on the team for.

Bot accounts SHALL be left out: nobody manages a bot's timesheet, and a reader
who genuinely wants one can add it by name. Accounts that are not active SHALL
NOT be left out. An inactive account that logged time in the window is somebody
who did the work and has since been blocked or left, which is the opposite of the
clutter the old rule removed from a membership list.

#### Scenario: Seeding a team from who logged time in a group

- **WHEN** the reader chooses a group to start a team from
- **THEN** the team carries the people who logged time in it over the window

#### Scenario: Seeding from a group reached through an ancestor

- **WHEN** the reader is a member of a parent group and searches for one of its
  subgroups
- **THEN** the subgroup is offered, and choosing it builds a team from whoever
  logged time in it

#### Scenario: Somebody with access who never logged time

- **WHEN** a person has access to the group and logged no time in the window
- **THEN** they are not on the seeded team
- **AND** they can still be added by name

#### Scenario: A bot that logged time

- **WHEN** a bot account logged time in the group
- **THEN** it is not put on the team

#### Scenario: A blocked account that logged time

- **WHEN** an account that is no longer active logged time in the group
- **THEN** it is put on the team like anybody else

#### Scenario: More contributors than were read

- **WHEN** the group holds more entries than the read covers
- **THEN** the team carries whoever the read did find
- **AND** nothing on the screen claims they are all of them
- **AND** anybody it missed can still be added by name

#### Scenario: Adding from a group a team already exists

- **WHEN** the reader asks an existing team for more people from a group
- **THEN** whoever logged time there and is not already on the team joins it
- **AND** nobody on the team is removed for not being in that group

#### Scenario: A suggestion is not a subscription

- **WHEN** a person stops logging time in the group a team was seeded from
- **THEN** they are still on the team, and still have a row

### Requirement: GROUP-16 — Rows can be ordered by person or by hours

The reader SHALL be able to order rows by person and by total hours, and the
current ordering SHALL be reported to assistive technology.

Ordering SHALL be available on those two columns only. A sortable heading is a
place the keyboard stops, and a month of sortable day columns would put the
report's own contents dozens of stops away.

#### Scenario: Ordering by hours

- **WHEN** the reader orders the rows by total hours
- **THEN** the rows are ordered by their totals and the heading reports the
  ordering

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
- **THEN** the controls, the region holding the table, the orderable headings and
  each person's name are reachable
- **AND** no individual cell is a stop

### Requirement: GROUP-18 — Another person's hours are not left on the device, and their names are not left anywhere careless

The report SHALL NOT be written to the device's storage. The hours it holds
belong to people other than the reader, and a shared or borrowed machine would
otherwise show them to whoever opens the app next.

Neither SHALL a team's roster. It is not an hour, but it is a list of
colleagues' names, and the reason the hours are kept off the device applies to a
name unchanged: a shared or borrowed machine must not tell whoever opens the app
next who this reader watches. Only the identifier of the team last looked at may
be kept, which is a label of the reader's own and names nobody.

This is the narrower rule of the two available, and it is the one the screen
already lives by: every figure on it is fetched before it is drawn. A roster
cached to paint a picker sooner would put half a screen on disk and leave the
other half off it, for a saving measured against a request the screen has to make
anyway.

#### Scenario: Returning to the report

- **WHEN** a reader who has seen a report opens the app again
- **THEN** no figures are shown until the provider has answered again
- **AND** no colleague's name is on the device

#### Scenario: Signing out

- **WHEN** a reader signs out
- **THEN** no team, no roster and no figure is left on the device
