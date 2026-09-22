# team-timelog-report

## MODIFIED Requirements

### Requirement: GROUP-15 — The reader can find the people they mean

The reader SHALL be able to put a person on a team by searching the provider for
them, and SHALL be able to build a team out of whoever logged time in a group
they are authorized in — including one they can read through membership of an
ancestor group rather than of the group itself.

A group SHALL be how a team is started, not a control that lives beside it. The
reader names a group once; the people that group's hours belong to arrive as the
team. Offering the group as a standing filter over a list of candidates asks the
reader to re-answer, one person at a time, a question they already answered by
naming the squad — and the same group SHALL remain reachable afterwards, as a way
to merge in whoever has appeared since, rather than as a control that is always
on screen.

The seed is whoever logged, not whoever is a member. A group's membership is a
list of people with access, most of whom may never have touched time tracking;
the people a lead is building a report about are the people whose hours there are
to report. Reading them costs a paged read of the group's timelogs where a
membership list cost one cheap page, and that is the price of suggesting the
right people rather than everybody with a key.

That price SHALL be bounded, because it is paid while somebody waits. The window
is a trailing thirty days and the read stops after a small fixed number of pages.
People saturate long before entries do — a squad's month is hundreds of timelogs
and perhaps a dozen names — so reading further mostly buys the same names again,
and the reader is left looking at nothing while it happens.

A seeded team SHALL be a team and nothing more. The reader chooses who stays, and
the team SHALL NOT change afterwards because the group's contributors did. A
roster that followed a group would take a colleague off a lead's report the week
they moved team, and would silently remove their hours from every total in every
month already reported — including months they were on the team for.

The window the people were read over SHALL be stated. A list of who logged time
answers a different question depending on when, and a reader who is not told the
window cannot tell an absence from a holiday.

Bot accounts SHALL be left out: nobody manages a bot's timesheet, and a reader
who genuinely wants one can add it by name. Accounts that are not active SHALL
NOT be left out. An inactive account that logged time in the window is somebody
who did the work and has since been blocked or left, which is the opposite of the
clutter the old rule removed from a membership list.

Where the group could not be read to exhaustion the screen SHALL say so rather
than presenting a partial list as a census.

#### Scenario: Seeding a team from who logged time in a group

- **WHEN** the reader chooses a group to start a team from
- **THEN** the team carries the people who logged time in it over the stated
  window
- **AND** the window is stated

#### Scenario: Seeding from a group reached through an ancestor

- **WHEN** the reader is a member of a parent group and searches for one of its
  subgroups
- **THEN** the subgroup is offered, and choosing it builds a team from whoever
  logged time in it

#### Scenario: Somebody with access who never logged time

- **WHEN** a person has access to the group and logged no time in the window
- **THEN** they are not on the seeded team
- **AND** they can still be added by name

#### Scenario: A bot that logged time

- **WHEN** a bot account logged time in the group
- **THEN** it is not put on the team

#### Scenario: A blocked account that logged time

- **WHEN** an account that is no longer active logged time in the group
- **THEN** it is put on the team like anybody else

#### Scenario: More contributors than were read

- **WHEN** the group holds more entries than the read covers
- **THEN** the screen says the people it found may not be all of them

#### Scenario: Adding from a group a team already exists

- **WHEN** the reader asks an existing team for more people from a group
- **THEN** whoever logged time there and is not already on the team joins it
- **AND** nobody on the team is removed for not being in that group

#### Scenario: A suggestion is not a subscription

- **WHEN** a person stops logging time in the group a team was seeded from
- **THEN** they are still on the team, and still have a row
