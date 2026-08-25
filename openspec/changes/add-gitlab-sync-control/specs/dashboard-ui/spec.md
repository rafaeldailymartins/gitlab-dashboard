## ADDED Requirements

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
