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
the reader where they were, with the report showing whatever was last saved.

**Edits SHALL be collected and written once, when the reader saves them.** The
surface SHALL offer a way to save what has been edited and a way to discard it,
and until one of those is chosen the stored list SHALL be unchanged. This
reverses the rule that every edit is its own write, and the reversal is about
what a list of people costs to get wrong: removing a colleague was final the
moment it was clicked, and the only way back was to find them again by name.

It also removes a defect that was invisible under the old rule. Each write was
built from the list as it was last read and carried the version read with it, so
two edits made in quick succession were both built on the list before either —
the second reverting the first, or being refused with the reader's own two clicks
reported as somebody else's change. One write from one snapshot cannot do that.

The report behind the surface SHALL follow what was saved, never what is being
edited. A report that moved with an unsaved draft would have to be put back when
the draft was discarded, which is a worse thing to do to a reader than making
them press a button.

**Saving and discarding both SHALL close the surface.** Each of them says what
to do about the edits, and there is nothing left to do here afterwards; leaving
the reader in front of a list they have finished with is the interface asking
them to dismiss it twice. Discarding SHALL be offered whether or not anything
has been edited, because it is the way out as much as it is the way to undo —
a reader who opened this to look at something should not have to find a
different control to leave by.

A save that was refused SHALL NOT close, because there is something left to do
and something left to read.

**Dismissing** with unsaved edits is the one way out that SHALL ask rather than
act, and every form of it SHALL reach the same question. Dismissing says only
that the reader wants out, not what should become of what they typed; saving and
discarding say both, and asking them again would be asking them to repeat
themselves.

A team SHALL be creatable in one action. The reader names a GitLab group and the
team is minted, named after it and filled with the people that group's hours
belong to. Building the same team by adding people one at a time SHALL remain
possible and SHALL remain the way a team is corrected, but it is not the way one
is started: a lead who wants their squad wants it now, and a dozen edits to spell
out what one name already said is a chore invented by the interface.

How far back that group was read is `team-timelog-report` GROUP-15's to decide,
and this requirement SHALL NOT presume the answer. It said "over the stated
window" while GROUP-15 required the window to be stated; GROUP-15 no longer does,
and a scenario here asserting it would have left the two capabilities disagreeing
about the same click, with nothing to catch it — `openspec validate` reads one
capability at a time.

#### Scenario: Making a team

- **WHEN** the reader names a new team, adds two people to it and saves
- **THEN** the team is listed with those two people

#### Scenario: Making a team from a group in one action

- **WHEN** the reader chooses a GitLab group to start a team from
- **THEN** a team is being edited, named after that group, carrying the people
  who logged time in it over the window
- **AND** the reader did not have to add any of them individually

#### Scenario: Taking somebody off a team

- **WHEN** the reader removes a person from a team and saves
- **THEN** that person has no row in the team's report, and no total counts their
  hours

#### Scenario: Adding somebody who is already on the team

- **WHEN** the reader adds a person who is already on the team
- **THEN** the team is unchanged, and that person has one row

#### Scenario: Renaming a team

- **WHEN** the reader renames a team and saves
- **THEN** an address naming that team still shows the same team

#### Scenario: Editing a team without leaving the month

- **WHEN** the reader opens the team editor from the report, changes the team and
  saves
- **THEN** they are on the same report, showing the same month, with the change
  in it

#### Scenario: Edits are not stored until they are saved

- **WHEN** the reader removes a person from a team and does not save
- **THEN** the stored team still has that person

#### Scenario: Discarding what was edited

- **WHEN** the reader edits a team and discards the edits
- **THEN** the team is as it was before they were made

#### Scenario: Dismissing with edits that were not saved

- **WHEN** the reader edits a team and tries to dismiss the surface
- **THEN** they are asked what to do with the edits, and the surface is still
  open

#### Scenario: Saving closes

- **WHEN** the reader edits a team and saves
- **THEN** the edits are stored and the surface is no longer open

#### Scenario: Discarding closes

- **WHEN** the reader discards what they edited
- **THEN** the surface is no longer open, and nothing was stored

#### Scenario: Several edits are one write

- **WHEN** the reader makes more than one change to a team and saves once
- **THEN** every one of the changes is stored, and each is stored exactly as the
  reader made it

### Requirement: TEAM-4 — A change is reported as saved, or as not saved

A change SHALL be reported as saved — the surface closing is that report — or as
not saved, and a change that was not
saved SHALL leave the stored team as it was rather than as the reader typed it. A
configuration screen that accepts an edit and loses it is worse than one that
refuses it.

**What was edited SHALL survive a save the store could not be reached for.**
The reader SHALL be told the save did not happen and SHALL still be looking at
what they edited, so that trying again does not mean doing it again. A refusal
used to cost one click; it now costs everything done since the surface was
opened, and discarding that silently would make saving on purpose worse than the
rule it replaced. Nothing was stored, so nothing about what they edited has
stopped being true.

A save refused because somebody else wrote first is the exception, and it is
TEAM-5's: the list moved under the reader, and they SHALL be shown whose it is
now rather than their own edits against a version that no longer exists. That is
the one refusal allowed to take the edits away, because it is the one where
keeping them would mean showing a list nobody has.

A write that did not reach the store SHALL NOT be recorded on the device as
though it had, and SHALL NOT be queued for a later attempt. A queued write is a
write whose ordering nobody can see, replayed against a document somebody else's
device may already have changed.

A team larger or longer than the store accepts SHALL be refused with its reason
before anything is written.

#### Scenario: A change that could not be saved

- **WHEN** the reader edits a team and the store will not accept it
- **THEN** the screen says the change was not saved
- **AND** the stored team is as it was

#### Scenario: What was edited is still there to try again

- **WHEN** a save does not reach the store
- **THEN** the edits the reader made are still on screen, and saving is still
  offered

#### Scenario: A failed write is not kept for later

- **WHEN** a change could not be saved and the reader reloads the screen
- **THEN** the change is not present, and nothing attempts it again
