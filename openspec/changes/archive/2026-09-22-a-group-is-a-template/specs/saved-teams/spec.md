# saved-teams

## MODIFIED Requirements

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
