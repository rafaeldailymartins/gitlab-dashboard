# dashboard-ui Specification

## Purpose

The screens a person uses to see how much they worked and what they worked on.
Most of them answer for one reader about their own hours; the requirements here
are cross-cutting, and bind every screen the app has, including the one that
reports a whole group.

## Requirements

### Requirement: UI-1 — The current week is visible at a glance

The dashboard SHALL present the current week as one bar per day, each measured
against the daily target, with the current day distinguished from the others and
each day's hours readable without interaction.

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

### Requirement: UI-2 — Today, this week and this month are summarised

The dashboard SHALL show total hours for today, the current week and the current
month, each with its progress against the corresponding target.

#### Scenario: Reading the summary

- **WHEN** a person opens the dashboard
- **THEN** they see hours for today, this week and this month
- **AND** each shows how it compares with its target

#### Scenario: A period with nothing logged

- **WHEN** no time has been logged in a summarised period
- **THEN** that period reads as zero hours rather than as missing data

### Requirement: UI-3 — History reads as a day-by-day feed

Below the summary the dashboard SHALL list days newest first, each showing its
date, weekday, total hours and a proportional bar, and SHALL extend the list as
the person scrolls.

#### Scenario: Scrolling into older history

- **WHEN** a person scrolls past the days already loaded
- **THEN** older days are appended in the same order without the list jumping

#### Scenario: Reaching the beginning of history

- **WHEN** a person scrolls past their oldest entry
- **THEN** the list ends with a clear indication that there is nothing older

### Requirement: UI-4 — A day opens into what was worked on

A day in the feed SHALL be expandable to show each issue and merge request
worked on that day, with its project, reference, title and hours.

#### Scenario: Expanding a day

- **WHEN** a person opens a day with two work items
- **THEN** both items are listed with their project, reference, title and hours
- **AND** the listed hours sum to the day total

#### Scenario: A day with unattributed time

- **WHEN** a day contains time not attached to any work item
- **THEN** that time is listed as unattributed rather than omitted

### Requirement: UI-5 — A day is addressable by URL

Each day SHALL have its own address that can be shared and reloaded, and
reloading it SHALL show that day's detail directly.

#### Scenario: Reloading a day address

- **WHEN** a person reloads the page while viewing a specific day
- **THEN** the same day's detail is shown

#### Scenario: A day with no logged time

- **WHEN** a person opens the address of a day with no entries
- **THEN** the day is shown as having no logged time, not as an error

### Requirement: UI-6 — Distribution over a month and across projects

The dashboard SHALL offer a view showing hours per day across a month at a
glance, hours split by project for the period, and the work items with the most
hours, sortable by hours.

#### Scenario: Spotting an unlogged working day

- **WHEN** a person views the month
- **THEN** working days with no logged time are visually distinct from days with
  time and from days outside the month

#### Scenario: Sorting the busiest work items

- **WHEN** a person sorts the work items by hours
- **THEN** the item with the most hours in the period is listed first

### Requirement: UI-7 — Absence of data is distinguishable from absence of loading

The interface SHALL distinguish "nothing was logged" from "this has not loaded
yet" and from "loading failed".

#### Scenario: A day with nothing logged

- **WHEN** a loaded day contains no entries
- **THEN** it is shown as zero hours, not as a loading placeholder

#### Scenario: A day not yet loaded

- **WHEN** a day is still being retrieved
- **THEN** it is shown as loading, not as zero hours

### Requirement: UI-8 — Every screen is usable without a mouse and free of accessibility violations

Every screen SHALL be operable by keyboard alone with a visible focus
indicator, and SHALL contain no WCAG 2.1 Level AA violation in either colour
theme.

#### Scenario: Keyboard-only navigation

- **WHEN** a person moves through the dashboard using only the keyboard
- **THEN** every interactive element can be reached and activated
- **AND** the focused element is always visibly indicated

#### Scenario: Automated accessibility audit

- **WHEN** each screen is audited against WCAG 2.1 Level A and AA in light and
  in dark theme
- **THEN** no violation is reported

#### Scenario: Figures are readable by assistive technology

- **WHEN** a screen reader reads a day's bar
- **THEN** it announces the hours and the target rather than describing the shape

### Requirement: UI-9 — Loading does not move the page

While data is loading the interface SHALL reserve the space the loaded content
will occupy, so arriving data does not shift what is already on screen.

#### Scenario: Data arrives while reading

- **WHEN** the report finishes loading while a person is reading the screen
- **THEN** no already-visible element changes position

### Requirement: UI-10 — A work item links back to GitLab

Every work item shown SHALL link to that issue or merge request in GitLab, and
the link SHALL open without discarding the current view.

#### Scenario: Following a work item

- **WHEN** a person activates a work item's link
- **THEN** the corresponding GitLab page opens in a new context
- **AND** the dashboard remains as it was

### Requirement: UI-11 — The dashboard adapts to a phone

Every screen SHALL be usable at a viewport 375 pixels wide without horizontal
page scrolling.

#### Scenario: Viewing on a narrow screen

- **WHEN** a person opens any screen at a viewport 375 pixels wide
- **THEN** all content is reachable by vertical scrolling only
- **AND** any wide element scrolls within its own bounds

### Requirement: UI-12 — The dashboard greets the person whose hours these are

The dashboard SHALL greet the signed-in person by name, and SHALL leave the
greeting unsaid rather than incomplete when no name is available.

#### Scenario: Arriving at the dashboard

- **WHEN** a signed-in person opens the dashboard
- **THEN** they are greeted by their own name, above the day's heading

#### Scenario: No name to greet by

- **WHEN** the provider returns no name for the signed-in person
- **THEN** no greeting is shown, and the screen's layout is unchanged

### Requirement: UI-13 — The reader can ask GitLab for the hours again

Every screen that presents hours SHALL offer a control that requests the loaded
history from GitLab again. While that request is in flight the control SHALL
report it, and SHALL animate only where the reader has not asked for reduced
motion. The same control SHALL be the way to retry after a failed request, so
there is one place to press whether the figures are stale or missing.

#### Scenario: Asking for fresh hours

- **WHEN** a person activates the sync control
- **THEN** the loaded history is requested from GitLab again
- **AND** the figures already on screen stay until the answer replaces them

#### Scenario: A request already in flight

- **WHEN** a request is in flight
- **THEN** the control reports that the hours are being updated

#### Scenario: Retrying a failure

- **WHEN** the last request failed and its reason is on screen
- **THEN** activating the sync control requests the hours again

### Requirement: UI-14 — The screen says when the hours last arrived

A screen presenting hours SHALL say when they last arrived from GitLab, in the
reader's own time zone and language: a time of day when that was today, and a
date with a time when it was not. Before any answer has arrived it SHALL say so
rather than showing an empty or invented time. A failed request SHALL NOT
advance that time.

#### Scenario: Hours that arrived today

- **WHEN** the hours on screen arrived from GitLab earlier the same day
- **THEN** the screen names the time of day they arrived

#### Scenario: Hours restored from a previous day

- **WHEN** the hours on screen were restored from a device cache filled on an
  earlier day
- **THEN** the screen names that date as well as the time

#### Scenario: Nothing has arrived yet

- **WHEN** no answer has arrived from GitLab yet
- **THEN** the screen says the hours have not been synced rather than naming a
  time

### Requirement: UI-15 — The screens say what could not be read

A screen presenting hours SHALL name an entry whose project could not be read
rather than leaving the place where a project belongs blank, and SHALL do so in
the reader's language. In a split by project, the group holding those entries
SHALL be named the same way.

A screen SHALL report how many entries were counted without their project, and
separately how many could not be read at all. The second is hours missing from
the figures on screen, and a screen SHALL NOT present those figures as whole
while it knows they are short. When nothing was withheld, a screen SHALL say
nothing about it rather than showing an empty or zero notice.

#### Scenario: A breakdown row whose project could not be read

- **WHEN** a day's breakdown holds an entry with no readable project
- **THEN** the row names it as a project that could not be read, in the reader's
  language

#### Scenario: The split by project names the group

- **WHEN** the split by project holds the group of entries with no readable
  project
- **THEN** that group is named as projects that could not be read

#### Scenario: Entries counted without their project

- **WHEN** three entries were counted without their project
- **THEN** the screen says three entries were counted without their project
- **AND** the hour figures stay on screen

#### Scenario: Entries that could not be read at all

- **WHEN** an entry could not be read at all
- **THEN** the screen says the figures are short by what could not be read

#### Scenario: Nothing was withheld

- **WHEN** every entry was read in full
- **THEN** the screen says nothing about unread entries
