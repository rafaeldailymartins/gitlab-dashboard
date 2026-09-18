## Purpose

Reading the hours logged inside one GitLab group over one calendar month,
arranged per person and per day in the reader's own time zone, so a team lead can
see who logged what — and, just as importantly, who logged nothing. Every figure
carries how much of the truth the provider was willing to show the reader, because
a number beside a colleague's name is one somebody makes a decision about.

## ADDED Requirements

### Requirement: GROUP-1 — The report covers one named group, and says what it covers

The report SHALL cover time logged on issues and merge requests belonging to one
named group and its subgroups, and no other group. A group the provider will not
resolve for the reader SHALL be refused and named as such, never presented as a
group with no hours.

The screen SHALL state the scope of what it covers, because that scope is
narrower than "everything this team worked on": time logged against work items
that belong to no project is outside it, and cannot be detected or counted.

#### Scenario: A group the reader may not read

- **WHEN** a reader opens a group the provider will not resolve for them
- **THEN** the screen says the group could not be read
- **AND** no hours, no people and no totals are shown

#### Scenario: The scope is stated with the figures

- **WHEN** a report is shown for a group
- **THEN** the screen states that the figures cover issues and merge requests in
  that group and its subgroups

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

### Requirement: GROUP-3 — Everyone in the group is accounted for, whether or not they logged anything

Rows SHALL be the union of the group's membership and every person observed
logging time in the period. Whoever logged nothing SHALL still be named on the
screen, because that is the fact the report exists to surface — but not as a row
of empty cells: a row is for figures, and a line of dashes between two lines of
figures costs the reader more than it tells them. Once the period has been read
in full, a person with no visible entries and nothing withheld SHALL be left out
of the table, and SHALL NOT be named anywhere else on the screen either. Naming
them would read as "these people logged nothing", and that is a claim this
screen cannot support: it sees one group, and an hour logged on an issue in
another group is invisible from here.

A person whose hours the provider counted and would not show SHALL keep their
row. What their row says is which days the shortfall belongs to, and a footnote
cannot carry that.

Nobody SHALL be left out while the period is still being read: until then
"logged nothing" is indistinguishable from "not read yet".

Bots and accounts that are not active SHALL be dropped from the membership half
only. A person who logged time and is not, or is no longer, a member SHALL keep
their row: they logged those hours, and dropping the row would silently remove
them from every total.

Row order SHALL be deterministic and SHALL NOT depend on the machine the report
is rendered on.

#### Scenario: A member who logged nothing

- **WHEN** a person is a member of the group and logged no time in the month
- **AND** the month has been read in full
- **THEN** they have no row
- **AND** no sentence on the screen names them

#### Scenario: A member who logged nothing, while the month is still being read

- **WHEN** a person is a member of the group and no entry has arrived for them
- **AND** the month has not been read in full
- **THEN** they have a row, whose cells are reserved space rather than figures

#### Scenario: A member whose hours were all withheld

- **WHEN** the provider reports hours for a member and showed the reader none of
  them
- **THEN** they keep their row, which carries the shortfall

#### Scenario: Someone who logged time but is not a member

- **WHEN** a person logged time in the group during the month and is not in the
  group's membership
- **THEN** they have a row, and their hours are counted in every total

#### Scenario: A bot account in the membership

- **WHEN** the group's membership includes a bot account that logged no time
- **THEN** that account has no row

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

An empty cell SHALL be distinguishable between four different facts, and SHALL
NOT collapse any two of them:

- a day on which the person logged nothing **in this group**,
- a day on which nothing was expected,
- a day that has not happened yet,
- a day whose entries have not been read yet.

The distinction SHALL be carried by something other than colour alone.

No cell SHALL say that a person logged nothing. Every figure on this screen is
scoped to one group, and a person's hours on an issue in another group are not
in the answer and cannot be seen from here. So the strongest claim an empty
cell may make is that this group holds no hours for that day — a statement
about the group, which the screen measured, rather than about the person, which
it did not. The same holds for the line naming whoever has no row, and for the
sentence shown when the whole group is empty.

The scope SHALL be stated where the figures are read, not only above them. A
reader who reaches the table by landmark or by table navigation never passes
the heading, so the table caption carries it.

#### Scenario: A day with an expectation and nothing logged

- **WHEN** a day in the past carries an expectation and the person logged nothing
  on it that this group can see
- **THEN** the cell is marked as empty, and assistive technology says that the
  group holds no hours for it — never that the person logged none

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

While the period has not been read in full, the report SHALL NOT present any
per-person figure as that person's total. Space SHALL be reserved for the figure
instead, so that arriving data does not move the page and no reader can mistake a
partial read for a person who logged nothing.

An aggregate over the whole group MAY be shown before the period is read in full,
and SHALL then be marked as a floor rather than stated as the period's total.

#### Scenario: A person whose hours arrive last

- **WHEN** the period is still being read and a person's entries have not arrived
  yet
- **THEN** their row shows reserved space rather than a total, and no cell of
  theirs is marked as a day they failed to log

#### Scenario: The group total before the period is read in full

- **WHEN** the period is still being read
- **THEN** the group's total is presented as a floor that may rise, not as the
  month's figure

#### Scenario: The period is read in full

- **WHEN** every entry in the period has been read
- **THEN** every figure is presented as final

### Requirement: GROUP-8 — The report states how much the provider did not show the reader

The provider removes entries the reader is not allowed to read without reporting
an error and without leaving a gap, while separately reporting how many entries
exist in the period and how many seconds they hold. The report SHALL use that
difference to state how much is missing, rather than presenting what it received
as everything there is.

The difference SHALL be reported in whichever direction it falls. A difference
that means the figures on screen are too high SHALL NOT be reported as nothing
missing, because a withheld correction moves the figures the other way.

When nothing is missing, the report SHALL say nothing about it rather than
showing an empty or zero notice.

#### Scenario: Entries the reader may not read

- **WHEN** the provider reports more entries in the period than it showed the
  reader
- **THEN** the report states how many entries and how many hours are missing from
  the figures

#### Scenario: The figures are higher than the provider's own total

- **WHEN** the entries shown hold more seconds than the provider reports for the
  period
- **THEN** the report states that the figures may be too high, rather than
  stating that nothing is missing

#### Scenario: Nothing was withheld

- **WHEN** every entry the provider counted was also shown to the reader
- **THEN** the report says nothing about missing entries

### Requirement: GROUP-9 — A shortfall belongs to the row it came from

A shortfall SHALL be attributed to the person whose hours are short, not only to
the group. A row whose visible hours fall short of what the provider reports for
that person SHALL show the shortfall beside its total.

A row whose entries the reader may not read at all SHALL be distinguishable from
a row belonging to a person who logged nothing. Those are opposite facts, and
presenting them the same way is the failure this requirement exists to prevent.

The comparison SHALL be made over one window. What the provider declares covers
the window it was asked about — the month widened by a day at each end — so what
it is compared against SHALL cover that same window, not the month drawn on
screen. A row that compared a declaration over the window against the hours
drawn for the month would report every hour anybody logged on a padding day as
an hour that had been withheld from the reader, which is both false and common:
it needs only somebody to log time on the last day of the month before.

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

Where the provider will say so, a withheld hour SHALL be shown against the
column it was logged in rather than only against the person. The entries
themselves are unrecoverable — the provider removes the node, leaving no id and
no date — so the day SHALL be learned by asking the same aggregate over one
column's span at a time.

A placed hour SHALL be **added into** the figure for that column rather than
drawn beside it. The provider's own total for a day is the more useful answer to
the question this screen is opened with — did this person's day add up — and it
is the more correct one. Every total SHALL then be rebuilt from the summed
figures, so that a row total, a column total and the corner still agree with one
another and with the cells above them.

A cell holding hours the reader cannot open SHALL say so to assistive technology,
even though nothing marks it visually. A screen that folds an unreadable hour
into a number and says nothing at all about it is vouching for something it
cannot open.

The spans SHALL be the exact instants each column opens and closes at in the
reader's own zone, one microsecond apart so that two adjacent spans neither
share an instant nor leave a gap between them. Asking SHALL be conditional on
the row already being known to be short by entry count, so a report in which
nothing was withheld costs nothing to produce.

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

### Requirement: GROUP-20 — The group is remembered between visits

The group the reader chose SHALL be remembered, so that opening the report again
does not begin by picking their own team out of a list.

An address that names a group SHALL NOT be overridden by what was remembered — a
link somebody sent outranks this reader's habit — and an address that names none
SHALL be completed by redirecting, so that what is on screen is still what the
address says. Only the path is kept: a group's hours belong to other people, and
GROUP-18 forbids writing those to a device that may be shared.

#### Scenario: Coming back

- **WHEN** the reader opens the report with no group in the address
- **AND** they chose one on an earlier visit
- **THEN** the address is completed with it, and the screen matches the address

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

The group and the month SHALL travel in the address, so a reader can send someone
else the exact report they are looking at.

An address naming no group SHALL ask the reader to choose one rather than
failing. An address whose group or month cannot be read SHALL be recovered from
rather than crashing the screen.

#### Scenario: Opening a shared address

- **WHEN** a reader opens an address naming a group and a month
- **THEN** the report for that group and that month is shown

#### Scenario: Moving to another month

- **WHEN** the reader moves to the previous month
- **THEN** the address changes to that month and the report is shown for it

#### Scenario: An address that names no group

- **WHEN** the reader opens the report's address with no group named
- **THEN** the screen asks them to choose a group, and reports no error

#### Scenario: An address that cannot be read

- **WHEN** the reader opens the report's address with a month that is not a real
  month
- **THEN** the screen recovers to a month it can show, rather than failing

### Requirement: GROUP-15 — The reader can find a group they have access to

The reader SHALL be able to search for and choose a group they are authorized in,
including one they can read through membership of an ancestor group rather than
of the group itself.

#### Scenario: Choosing a group reached through an ancestor

- **WHEN** the reader is a member of a parent group and searches for one of its
  subgroups
- **THEN** the subgroup is offered, and choosing it shows its report

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

### Requirement: GROUP-18 — Another person's hours are not left on the device

The report SHALL NOT be written to the device's storage. The hours it holds
belong to people other than the reader, and a shared or borrowed machine would
otherwise show them to whoever opens the app next.

#### Scenario: Returning to the report

- **WHEN** a reader who has seen a report opens the app again
- **THEN** no figures are shown until the provider has answered again
