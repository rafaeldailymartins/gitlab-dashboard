## ADDED Requirements

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
