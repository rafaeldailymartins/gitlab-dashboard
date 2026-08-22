## Purpose

Turns the signed-in person's raw GitLab time tracking into the per-day and
per-work-item hour totals every screen in the dashboard is built from.

## ADDED Requirements

### Requirement: REPORT-1 — Only the signed-in person's own time is reported

The report SHALL contain only time logged by the signed-in person, and SHALL
cover every project they logged time in rather than a preconfigured group or
project.

#### Scenario: Another person's entry is excluded

- **WHEN** a colleague logged time on an issue the signed-in person can see
- **THEN** that time does not appear anywhere in the report

#### Scenario: Time across unrelated projects is included

- **WHEN** the signed-in person logged time in two projects in different groups
- **THEN** both projects' entries appear in the report

### Requirement: REPORT-2 — Hours derive from seconds at two-decimal precision

GitLab reports durations in whole seconds. Every hour figure SHALL be derived
from seconds and rounded to two decimals, rounding a half hundredth away from
zero. Negative durations SHALL be supported, because they are how a person
corrects a mistaken entry. A duration that is not a finite number SHALL be
rejected rather than displayed.

#### Scenario: Converting a duration

- **WHEN** a duration of 24120 seconds is converted
- **THEN** the result is 6.7 hours

#### Scenario: Correcting a mistaken entry

- **WHEN** a duration of -3600 seconds is converted
- **THEN** the result is -1 hours

#### Scenario: Rejecting a duration that is not a number

- **WHEN** a duration that is not a finite number is converted
- **THEN** the conversion is rejected as invalid

### Requirement: REPORT-3 — A period total agrees with the days it is made of

A period total SHALL be accumulated in seconds from the entries the report has
retrieved and rounded once, so it always equals the sum of the days shown for
that period. A total whose period is not fully retrieved SHALL be reported as
unsettled rather than as final, and retrieval SHALL continue until it is settled.

The provider is not asked for a period: it filters by UTC calendar date, while a
day here is a day in the configured time zone, so a total it reported would
disagree with the days on screen by the hours logged on the boundary days.
Because history is read newest first, the periods this dashboard summarises —
today, this week, this month — are answered by the first response.

#### Scenario: Totals accumulate without compounding rounding

- **WHEN** a period total is compared with the sum of its days' underlying
  durations
- **THEN** they agree exactly, because accumulation happens in seconds and
  rounding happens once for display

#### Scenario: The recent periods need one request

- **WHEN** a person opens the dashboard
- **THEN** today, this week and this month are answered by the first response,
  without requesting a second page

#### Scenario: A period larger than one page

- **WHEN** a period holds more entries than one page
- **THEN** its total is reported as unsettled while older entries are still
  being retrieved
- **AND** it becomes settled once retrieval passes the start of the period

### Requirement: REPORT-4 — A day is a day in the person's time zone

Entries SHALL be grouped into calendar days according to the configured time
zone, not according to the time zone GitLab reports them in.

#### Scenario: An entry near a day boundary

- **WHEN** an entry's recorded instant falls on one calendar date in UTC and on
  the previous date in the configured time zone
- **THEN** it is counted on the date it falls on in the configured time zone

#### Scenario: Changing the time zone regroups the report

- **WHEN** the configured time zone changes
- **THEN** entries are regrouped and day totals are recalculated accordingly

#### Scenario: The requested period includes its edges

- **WHEN** a period is requested
- **THEN** entries on the first and last day of that period are included

### Requirement: REPORT-5 — A day breaks down by what was worked on

Each day SHALL report its total and a breakdown by work item, where a work item
is an issue or a merge request, carrying the item's reference, title, project
and total hours for that day.

#### Scenario: Two entries on the same item on the same day

- **WHEN** a person logs time twice on the same issue on the same day
- **THEN** the day shows that issue once, with the two durations summed

#### Scenario: One day across several items

- **WHEN** a person logs time on an issue and on a merge request on the same day
- **THEN** the day lists both, and the day total equals their sum

### Requirement: REPORT-6 — History loads on demand

Older history SHALL be retrieved incrementally as it is needed, one page per
request, and SHALL NOT be retrieved eagerly for a fixed window.

#### Scenario: Reaching the end of what is loaded

- **WHEN** a person reaches the end of the loaded history
- **THEN** exactly one further page is requested

#### Scenario: All history has been read

- **WHEN** no further pages remain
- **THEN** the report reports that history is complete and requests no more

### Requirement: REPORT-7 — Time logged without a work item is still counted

An entry not attached to an issue or a merge request SHALL still be counted in
its day's total and SHALL be presented as unattributed rather than omitted.

#### Scenario: An entry with no work item

- **WHEN** a day contains an entry with no associated issue or merge request
- **THEN** the day total includes it and the breakdown shows it as unattributed

### Requirement: REPORT-8 — A previously seen report is shown immediately

On a return visit the last known report SHALL be presented before any request
completes, and SHALL be replaced by fresh data when it arrives.

#### Scenario: Returning with a slow connection

- **WHEN** a person opens the dashboard again on a slow connection
- **THEN** the previously seen figures appear before any request completes
- **AND** they are marked as being refreshed until fresh data replaces them

#### Scenario: Refreshing fails

- **WHEN** the refresh request fails while cached figures are on screen
- **THEN** the cached figures remain visible and the failure is reported
  alongside them

### Requirement: REPORT-9 — Failures are explained and recoverable

A failure to retrieve the report SHALL be reported in a way that distinguishes
"you are not allowed" from "something went wrong", and SHALL offer a retry.

#### Scenario: The credential is not accepted

- **WHEN** GitLab rejects the request as unauthorized and renewal does not
  resolve it
- **THEN** the person is asked to sign in again

#### Scenario: GitLab is unavailable

- **WHEN** GitLab cannot be reached or returns an error
- **THEN** the failure is reported with a retry action, and retrying re-requests
  the same period
