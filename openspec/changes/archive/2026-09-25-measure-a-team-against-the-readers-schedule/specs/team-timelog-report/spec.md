# team-timelog-report

## MODIFIED Requirements

### Requirement: GROUP-11 — Hours are measured against a reference the screen states

A cell's hours SHALL be presented against the reader's own daily target — the
hours per weekday they set as their working hours — and the screen SHALL state
that this is what the marks are measured against. The app has no knowledge of
any colleague's working arrangement; the reader does, and has already written it
down one screen away. A table that measured against anything else would disagree
with the schedule the same reader configured, and an unstated reference would
make the report assert something about a colleague's contract nobody chose.

A column SHALL be presented as expecting nothing exactly when the reader's target
across it is zero: a day whose weekday has no target, or a week none of whose
days has one. The weekend is not special. A Saturday the reader expects hours on
is a working column, and a weekday they expect none on is not.

The comparison SHALL be carried by the length of a mark against a visible
reference point, and SHALL NOT depend on hue. Hours above the reference SHALL be
distinguishable from hours that exactly meet it.

#### Scenario: The reference is stated

- **WHEN** a report is shown
- **THEN** the screen states the reference the marks are measured against

#### Scenario: The reference is the reader's working hours

- **GIVEN** the reader's target is four hours on Saturday and none on Wednesday
- **WHEN** a report is shown
- **THEN** Saturday's columns are measured against four hours
- **AND** Wednesday's columns are presented as expecting nothing

The key SHALL list only the marks the table in front of the reader actually
uses. A key for something that is nowhere on screen sends them looking for it,
and finding nothing is indistinguishable from having missed it. The reference
itself is always listed, because it explains every figure there is.

#### Scenario: A day above the reference

- **WHEN** a person logs more hours on a day than the reference expects
- **THEN** the mark for that day is distinguishable from a day that exactly meets
  the reference, without relying on colour

#### Scenario: A report that uses none of a mark

- **WHEN** no cell in the table carries a given mark
- **THEN** the key does not explain it
