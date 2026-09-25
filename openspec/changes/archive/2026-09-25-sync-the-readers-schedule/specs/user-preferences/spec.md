# user-preferences

## ADDED Requirements

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
