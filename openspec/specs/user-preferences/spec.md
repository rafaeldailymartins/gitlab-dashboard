# user-preferences Specification

## Purpose

The settings that change how hours are computed and shown — the daily target,
the time zone that defines a day, the language and the colour theme. The device
is always the read path: every screen paints from what it last held, before
anything is asked of anybody. The schedule and the zone then follow the reader
to their other machines (PREF-7); the language and the colour theme do not,
because they are about the device in front of somebody.

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

### Requirement: PREF-7 — The schedule and the time zone follow the reader

The daily target and the time zone SHALL be kept where the reader's next device
can read them, so that one person's settings do not differ between their own
machines. The colour scheme and the language SHALL NOT be: those are about the
device in front of somebody, and the theme is applied before the first paint
(PREF-5), which a value fetched over the network cannot be.

They SHALL be stored under a key derived from the identity the store verified for
itself and from nothing the request carried, exactly as a reader's teams are, so
that reaching another reader's settings is not a request this endpoint can
represent.

The device SHALL remain the read path. Nothing on any screen SHALL wait for the
store before painting: the values in front of the reader when the application
opens are the ones the device last held, and the store reconciles afterwards.

Reconciliation SHALL be last write wins, decided by an instant recorded with the
settings. This is deliberately not how a team is reconciled. A roster is edited
by somebody watching it and silently losing a colleague from one is the worst
thing that surface can do, so a stale write there is refused and reported; a
preference changes in the background, one field at a time, and what a race costs
is one number the reader can see and set again.

A device that has recorded no instant SHALL NOT compete on order. It SHALL adopt
whatever the store holds, and SHALL publish its own settings only to a store
holding nothing at all — stamped as they are published, since a document nothing
can order is not one the store may keep. The first half is what stops a fresh
device from replacing settings the reader really set elsewhere; the second is
what carries the settings of a device that was holding them before any of this
existed.

A store that will not answer SHALL cost the reader nothing but the syncing. Their
own device's values stay in effect, every screen keeps working, and the surface
that owns these settings SHALL say that they are not being carried to the
reader's other machines — a setting that quietly stops following somebody is
found out months later, on the wrong figure.

#### Scenario: A setting made on one device is in effect on another

- **WHEN** the reader changes their Monday target on one device
- **AND** opens the application on another
- **THEN** that device reports and measures against the new target

#### Scenario: The settings in front of the reader do not wait for the store

- **WHEN** the application opens and the store has not answered yet
- **THEN** every screen paints with the values the device last held

#### Scenario: A device that cannot date its settings

- **WHEN** a device holding settings it has never recorded an instant for finds
  settings in the store
- **THEN** it takes the stored ones rather than replacing them with its own

#### Scenario: Two devices changed the same setting

- **WHEN** the same setting was changed on two devices
- **THEN** the change made later is the one that survives on both
- **AND** neither device asks the reader to resolve anything

#### Scenario: The store cannot be reached

- **WHEN** the settings cannot be carried to the store
- **THEN** the reader's own device keeps the values they set, in effect
- **AND** the settings screen says they are not being synced

#### Scenario: The colour scheme stays on the device

- **WHEN** the reader chooses a colour scheme on one device
- **THEN** their other device is unchanged, and neither flashes the wrong scheme
  on opening
