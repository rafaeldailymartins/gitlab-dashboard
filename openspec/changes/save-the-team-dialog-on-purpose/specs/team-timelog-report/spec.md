# team-timelog-report

## MODIFIED Requirements

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
