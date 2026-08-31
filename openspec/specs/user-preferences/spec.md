# user-preferences Specification

## Purpose

The settings that change how hours are computed and shown — the daily target,
the time zone that defines a day, the language and the colour theme — kept on
the reader's own device.

## Requirements

### Requirement: PREF-1 — A daily target defines what a full day is

The system SHALL hold a target number of hours per weekday, defaulting to eight
hours Monday through Friday and zero on Saturday and Sunday, and every progress
figure SHALL be measured against it.

#### Scenario: A weekday's default target

- **WHEN** a person has not changed their targets
- **THEN** a Tuesday's target is eight hours

#### Scenario: A weekend day's default target

- **WHEN** a person has not changed their targets
- **THEN** a Sunday's target is zero hours, and time logged on it counts as
  hours above target rather than as a shortfall

#### Scenario: A period target

- **WHEN** a week's progress is calculated
- **THEN** its target is the sum of that week's daily targets

### Requirement: PREF-2 — The daily target is configurable per weekday

A person SHALL be able to set a different target for each weekday, and the change
SHALL apply to every figure that is derived from a target.

#### Scenario: Setting a six-hour Friday

- **WHEN** a person sets Friday's target to six hours
- **THEN** Friday's progress and the week's target both reflect six hours

#### Scenario: Rejecting an impossible target

- **WHEN** a person enters a target that is negative or greater than
  twenty-four hours
- **THEN** the value is rejected with an explanation and the previous target is
  kept

### Requirement: PREF-3 — The time zone that defines a day is configurable

The system SHALL hold the time zone used to group entries into days, defaulting
to `America/Sao_Paulo`, and changing it SHALL regroup the report.

#### Scenario: Changing the time zone

- **WHEN** a person changes their time zone
- **THEN** day totals are recalculated for the new time zone

#### Scenario: Rejecting an unknown time zone

- **WHEN** a stored time zone is not one the browser recognises
- **THEN** the default time zone is used and the person is told the stored value
  was ignored

### Requirement: PREF-4 — The theme follows the system unless overridden

The colour theme SHALL follow the operating system's preference by default, and
a person SHALL be able to override it with light or dark.

#### Scenario: Following the system

- **WHEN** a person has not chosen a theme and their system prefers dark
- **THEN** the interface is dark

#### Scenario: The system preference changes while the app is open

- **WHEN** the system preference changes and the person has not chosen a theme
- **THEN** the interface follows the new preference without a reload

#### Scenario: An explicit choice wins

- **WHEN** a person chooses light while their system prefers dark
- **THEN** the interface is light, and remains light on a later visit

### Requirement: PREF-5 — The chosen theme applies before the first paint

The resolved theme SHALL be applied before the first paint, so no reader ever
sees the wrong colour scheme flash.

#### Scenario: Loading with a dark override

- **WHEN** a person who chose dark loads the application
- **THEN** the first painted frame is already dark

### Requirement: PREF-6 — Preferences persist and survive a damaged store

Preferences SHALL be kept on the device across visits, and unreadable or invalid
stored values SHALL fall back to defaults rather than breaking the application.

#### Scenario: Returning after setting preferences

- **WHEN** a person who set a target, time zone, language and theme returns later
- **THEN** all four are still in effect

#### Scenario: A corrupted stored value

- **WHEN** a stored preference cannot be read or does not match its expected
  shape
- **THEN** the default is used and the application continues to work

#### Scenario: Storage is unavailable

- **WHEN** the browser denies access to persistent storage
- **THEN** the application runs with defaults for the session instead of failing
