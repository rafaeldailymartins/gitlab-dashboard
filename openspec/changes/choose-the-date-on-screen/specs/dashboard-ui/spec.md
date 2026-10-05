# dashboard-ui

## ADDED Requirements

### Requirement: UI-17 — The dashboard can be read as of a chosen day

The dashboard SHALL offer a control that chooses the day it is read as of: the
day before, a control naming the day that opens a calendar to pick another
from, the day after, and a way back to today. No day after today SHALL be
offered. Every figure on the dashboard SHALL follow the
chosen day: its heading, the period figures (UI-2), the week strip (UI-1), and
the history feed, which SHALL begin at the chosen day.

The chosen day SHALL be part of the screen's address, so that reloading keeps it
and a link carries it. An address that names no day SHALL show today, and SHALL
keep showing today as the date changes. An address naming something that is not
a calendar date, or a day after today, SHALL show today rather than failing.

#### Scenario: Choosing an earlier day

- **WHEN** a person chooses yesterday on the dashboard
- **THEN** the day's figure reads yesterday's hours
- **AND** the address names yesterday

#### Scenario: Picking a day from the calendar

- **WHEN** a person opens the calendar and picks yesterday
- **THEN** the day's figure reads yesterday's hours
- **AND** the address names yesterday

#### Scenario: A chosen day survives a reload

- **WHEN** a person reloads the dashboard at an address naming a day forty days
  ago
- **THEN** the day's figure reads the hours logged that day

#### Scenario: Going back to today

- **WHEN** a person who chose an earlier day asks to go back to today
- **THEN** the day's figure is today's again
- **AND** the address names no day

#### Scenario: Stepping one day at a time

- **WHEN** a person steps to the previous day and then to the next
- **THEN** the dashboard is read as of the day they started from

#### Scenario: No day after today is offered

- **WHEN** the dashboard is read as of today
- **THEN** the control offers no later day

#### Scenario: An address that does not name a day

- **WHEN** a person opens the dashboard at an address whose day is not a calendar
  date
- **THEN** the dashboard is read as of today

#### Scenario: The feed begins at the chosen day

- **WHEN** a person chooses a day with later days already logged
- **THEN** the history feed lists the chosen day and the days before it, and none
  after it

### Requirement: UI-18 — Insights can be read for a chosen month

The insights screen SHALL offer a control that chooses the month it shows: the
month before, the month on screen, the month after, and a way back to the current
month. No month after the current one SHALL be offered. The heatmap, the split by
project and the table of work items (UI-6) SHALL all follow the chosen month.

The chosen month SHALL be part of the screen's address, so that reloading keeps
it and a link carries it. An address that names no month SHALL show the current
month. An address naming something that is not a month, or a month after the
current one, SHALL show the current month rather than failing.

While the chosen month is not yet fully retrieved, the screen SHALL show it as
loading rather than drawing days not yet read as days with nothing logged.

#### Scenario: Stepping back a month

- **WHEN** a person asks insights for the month before the one on screen
- **THEN** the screen names that month
- **AND** the address names it

#### Scenario: A chosen month survives a reload

- **WHEN** a person reloads insights at an address naming the month of an entry
  logged forty days ago
- **THEN** the split by project holds that entry's hours

#### Scenario: Going back to the current month

- **WHEN** a person who chose an earlier month asks to go back to the current month
- **THEN** the screen names the current month
- **AND** the address names no month

#### Scenario: No month after the current one is offered

- **WHEN** insights shows the current month
- **THEN** the control offers no later month

#### Scenario: An address that does not name a month

- **WHEN** a person opens insights at an address whose month is not a month
- **THEN** the screen shows the current month

## MODIFIED Requirements

### Requirement: UI-1 — The current week is visible at a glance

The dashboard SHALL present the week of the day it is read as of — today, unless
the reader chose another (UI-17) — as one bar per day, each measured against the
daily target, with the current day distinguished from the others and each day's
hours readable without interaction. A week the report has not yet retrieved SHALL
be shown as loading, not as seven empty days.

#### Scenario: Opening the dashboard mid-week

- **WHEN** a person opens the dashboard on a Wednesday
- **THEN** the week shows all seven days with Monday through Wednesday filled
- **AND** Wednesday is marked as today

#### Scenario: A day that met its target

- **WHEN** a day's hours reach its daily target
- **THEN** that day is shown as complete

#### Scenario: A day below its target

- **WHEN** a day's hours are below its daily target
- **THEN** the bar shows the shortfall relative to the target rather than
  relative to the largest day

#### Scenario: The week of an earlier day

- **WHEN** a person chooses a day in an earlier week
- **THEN** the strip shows the seven days of that week
- **AND** no day in it is marked as today

### Requirement: UI-2 — Today, this week and this month are summarised

The dashboard SHALL show total hours for the day it is read as of, the week
containing it and the month containing it, each with its progress against the
corresponding target. When that day is today, they SHALL be named today, this
week and this month; otherwise each SHALL be named by the dates it covers.

#### Scenario: Reading the summary

- **WHEN** a person opens the dashboard
- **THEN** they see hours for today, this week and this month
- **AND** each shows how it compares with its target

#### Scenario: A period with nothing logged

- **WHEN** no time has been logged in a summarised period
- **THEN** that period reads as zero hours rather than as missing data

#### Scenario: Reading the summary of an earlier day

- **WHEN** a person chooses an earlier day
- **THEN** they see hours for that day, its week and its month, each named by the
  dates it covers

### Requirement: UI-5 — A day is addressable by URL

Each day SHALL have its own address that can be shared and reloaded, and
reloading it SHALL show that day's detail directly, retrieving as much history
as that day needs.

#### Scenario: Reloading a day address

- **WHEN** a person reloads the page while viewing a specific day
- **THEN** the same day's detail is shown

#### Scenario: A day with no logged time

- **WHEN** a person opens the address of a day with no entries
- **THEN** the day is shown as having no logged time, not as an error

#### Scenario: A day older than the first page

- **WHEN** a person opens the address of a day older than the first page of
  history
- **THEN** the day is shown as loading until it is retrieved, not as having no
  logged time
