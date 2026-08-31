## ADDED Requirements

### Requirement: REPORT-10 — An answer that is partly usable is used

The provider may answer with entries and errors together: it returns the entries
it could resolve and reports, beside them, the ones it could not. The report
SHALL use such an answer. Only an answer carrying no usable entries SHALL be
treated as a failure, and it SHALL keep the classification failures already
have.

An answer that reports errors is never treated as complete. How many entries the
provider withheld SHALL be carried with the page, so nothing downstream can
mistake a short answer for the whole of the history.

#### Scenario: Entries and errors arrive together

- **WHEN** the provider answers with fifteen entries and an error about a
  sixteenth
- **THEN** the fifteen entries are reported
- **AND** the answer is not treated as a failure

#### Scenario: An answer with errors and no entries

- **WHEN** the provider answers with errors and no usable entries
- **THEN** the request is reported as refused by the provider

#### Scenario: A short answer is not mistaken for the whole history

- **WHEN** the provider withholds entries from a page
- **THEN** the page reports how many were withheld

### Requirement: REPORT-11 — Time logged in a project that cannot be read is still counted

The provider withholds an entry entirely when it cannot resolve which project
the time was logged in — because the person lost access to that project, or it
was archived, removed or moved. The hours in that entry are the person's own and
SHALL be counted.

When a page withholds entries, the report SHALL request that page again without
asking for the project, which is what the provider could not resolve, and SHALL
count the entries it recovers with no project attached. It SHALL make that
further request only for a page that withheld entries, and SHALL NOT count an
entry twice when it appears in both answers.

An entry counted this way SHALL appear in its day's total, in every period total
that covers it, and in the breakdown of what was worked on, presented as having
no readable project rather than omitted. In a split by project, entries with no
readable project SHALL be grouped together as one.

The report SHALL say how many entries it counted without their project, and how
many it could not recover at all. Entries it could not recover are hours missing
from every total that covers them, and the report SHALL NOT present those totals
as settled.

#### Scenario: An entry whose project cannot be read

- **WHEN** the provider withholds an entry because it cannot resolve its project
- **THEN** that entry's hours are counted in its day's total and in the period
  totals covering it
- **AND** the day's breakdown shows it with no readable project

#### Scenario: Recovering does not count an entry twice

- **WHEN** a page is requested again without the project and answers with every
  entry, including those the first answer already returned
- **THEN** each entry is counted once

#### Scenario: Nothing was withheld

- **WHEN** the provider answers a page with no entries withheld
- **THEN** no further request is made for that page

#### Scenario: The split by project keeps them together

- **WHEN** two entries in different unreadable projects are counted
- **THEN** the split by project shows them as one group with no readable project

#### Scenario: An entry that cannot be recovered at all

- **WHEN** an entry is still withheld after the page is requested without the
  project
- **THEN** the report says one entry could not be read
- **AND** the totals covering it are not reported as settled

#### Scenario: The report counts what it read without a project

- **WHEN** three entries are counted without their project
- **THEN** the report says three entries were counted without their project
