# saved-teams Specification

## Purpose

Keeping a team — a name and a hand-picked list of people — against the reader who
made it, so that the question "how did my team spend the month" survives a change
of device. A roster is not hours, but it is a list of colleagues and an assertion
about who belongs together, so it is held for one reader and reachable by no
other.

## Requirements

### Requirement: TEAM-1 — A team is a list the reader keeps

A reader SHALL be able to make a team, name it, add and remove people, rename it
and delete it, and SHALL be able to keep more than one.

Each team SHALL carry an identifier distinct from its name, so that renaming does
not change what an address to it means, and so that sharing a team can later be
added without a rename becoming a redirect.

A member SHALL be stored by the identifier the provider says cannot change — its
user identifier — with the username and display name kept beside it as what the
reader last saw. The username is how the provider is addressed; the identifier is
who was meant. A screen that could not draw a row until the provider answered
would have nothing to say in exactly the case where the provider will not.

Two members SHALL NOT share an identifier. Adding somebody already on the team
SHALL leave the team as it was rather than adding them twice, because a duplicate
row would count their hours twice in every total.

Teams SHALL be edited over the report rather than instead of it. A reader
discovers a team is wrong while reading its month, and the editing surface has no
address worth sending anybody — it is this reader's own private list — so
navigating away from the figures to fix the list they are about costs a page load
and the reader's place, and buys nothing. Closing the editing surface SHALL leave
the reader where they were, with the report showing what their changes did.

A team SHALL be creatable in one action. The reader names a GitLab group and the
team is minted, named after it and filled with the people that group's hours
belong to, in a single save. Building the same team by adding people one at a
time SHALL remain possible and SHALL remain the way a team is corrected, but it
is not the way one is started: a lead who wants their squad wants it now, and a
dozen writes to spell out what one name already said is a chore invented by the
interface.

How far back that group was read is `team-timelog-report` GROUP-15's to decide,
and this requirement SHALL NOT presume the answer. It said "over the stated
window" while GROUP-15 required the window to be stated; GROUP-15 no longer does,
and a scenario here asserting it would have left the two capabilities disagreeing
about the same click, with nothing to catch it — `openspec validate` reads one
capability at a time.

#### Scenario: Making a team

- **WHEN** the reader names a new team and adds two people to it
- **THEN** the team is listed with those two people

#### Scenario: Making a team from a group in one action

- **WHEN** the reader chooses a GitLab group to start a team from
- **THEN** a team exists named after that group, carrying the people who logged
  time in it over the window
- **AND** the reader did not have to add any of them individually

#### Scenario: Taking somebody off a team

- **WHEN** the reader removes a person from a team
- **THEN** that person has no row in the team's report, and no total counts their
  hours

#### Scenario: Adding somebody who is already on the team

- **WHEN** the reader adds a person who is already on the team
- **THEN** the team is unchanged, and that person has one row

#### Scenario: Renaming a team

- **WHEN** the reader renames a team
- **THEN** an address naming that team still shows the same team

#### Scenario: Editing a team without leaving the month

- **WHEN** the reader opens the team editor from the report and changes the team
- **AND** closes it
- **THEN** they are on the same report, showing the same month, with the change
  in it

### Requirement: TEAM-2 — A team survives the device

A team SHALL be stored where the reader's next device can read it. This report is
opened from more than one machine, and a list kept on one of them is a list that
is wrong on the other.

The store SHALL be the only place a roster rests. The device SHALL NOT keep one,
not even to paint sooner: a roster is a list of colleagues' names, and GROUP-18
keeps those off a machine somebody else may open next. The saving would be
measured against a request this screen has to make regardless.

A read that cannot reach the store SHALL say so and show no teams, rather than
showing a list it cannot vouch for.

#### Scenario: Another device

- **WHEN** a reader who made a team on one device opens the app on another
- **THEN** the same team is listed

#### Scenario: The store cannot be reached

- **WHEN** the reader's teams cannot be read from the store
- **THEN** the screen says so, and lists no teams

#### Scenario: Nobody's name is left behind

- **WHEN** a reader who has opened a team's report closes the app
- **THEN** no member of that team is named anywhere on the device

### Requirement: TEAM-3 — A team is the reader's own, and unreachable by anybody else

Every read and every write SHALL be answered only on a credential the provider
issued and the store verified for itself.

The identity a team is filed under SHALL be established from that verified
credential, and SHALL NOT be taken from anything the request carried — not a
field in its body, not a value in its address. A key the caller can name is a key
the caller can name somebody else's, so the store SHALL be built such that naming
another reader's teams is not expressible rather than merely refused.

A credential the store cannot verify SHALL be refused without distinguishing why,
so that probing it teaches nothing.

The credential SHALL grant no authority over anything but identity, and SHALL NOT
be written to storage, logged, or forwarded anywhere.

#### Scenario: A request with no credential

- **WHEN** a request for teams carries no credential
- **THEN** it is refused and no team is returned

#### Scenario: A credential the store cannot verify

- **WHEN** a request carries a credential the store cannot verify
- **THEN** it is refused in the same way as one carrying none

#### Scenario: One reader cannot reach another's teams

- **WHEN** a reader's credential is used to request teams
- **THEN** only that reader's teams are returned, whatever else the request
  carried

### Requirement: TEAM-4 — A change is reported as saved, or as not saved

A change SHALL be reported as saved or as not saved, and a change that was not
saved SHALL leave the team as it was rather than as the reader typed it. A
configuration screen that accepts an edit and loses it is worse than one that
refuses it.

A write that did not reach the store SHALL NOT be recorded on the device as
though it had, and SHALL NOT be queued for a later attempt. A queued write is a
write whose ordering nobody can see, replayed against a document somebody else's
device may already have changed.

A team larger or longer than the store accepts SHALL be refused with its reason
before anything is written.

#### Scenario: A change that could not be saved

- **WHEN** the reader edits a team and the store will not accept it
- **THEN** the screen says the change was not saved
- **AND** the team is shown as it was

#### Scenario: A failed write is not kept for later

- **WHEN** a change could not be saved and the reader reloads the screen
- **THEN** the change is not present, and nothing attempts it again

### Requirement: TEAM-5 — Two devices cannot silently overwrite each other

A write SHALL be accepted only against the version of the stored teams the writer
last read. A write made against an older version SHALL be refused and the current
version returned with it, so that the reader is told rather than obeyed.

Last write wins over a whole roster silently drops a colleague off it, which is
the failure this screen least deserves.

A writer that has not read SHALL be refused rather than allowed to replace what
it has not seen.

#### Scenario: Two tabs editing one team

- **WHEN** the reader changes a team in one tab and then saves an older version
  of it from another
- **THEN** the second save is refused, and the screen says the team was changed
  elsewhere and shows the current one

#### Scenario: A write that has not read first

- **WHEN** a write arrives that names no version it was made against
- **THEN** it is refused and nothing is stored
