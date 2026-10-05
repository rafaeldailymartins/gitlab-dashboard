# personal-timelog-report

## MODIFIED Requirements

### Requirement: REPORT-3 — A period total agrees with the days it is made of

A period total SHALL be accumulated in seconds from the entries the report has
retrieved and rounded once, so it always equals the sum of the days shown for
that period. A total whose period is not fully retrieved SHALL be reported as
unsettled rather than as final, and retrieval SHALL continue until it is settled.

The provider is not asked for a period: it filters by UTC calendar date, while a
day here is a day in the configured time zone, so a total it reported would
disagree with the days on screen by the hours logged on the boundary days.
Because history is read newest first, the periods this dashboard summarises for
today — today, this week, this month — are answered by the first response. The
periods of an earlier day the reader chose are answered once retrieval passes
the earlier of the start of that day's week and the start of its month.

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

#### Scenario: The periods of a chosen day

- **WHEN** the periods of a Wednesday are named
- **THEN** the day is that Wednesday, the week runs from the Monday before it to
  the Sunday after it, and the month is the calendar month containing it

#### Scenario: A week that began in the month before

- **WHEN** the chosen day falls in a week that began in the previous month
- **THEN** retrieval continues until it passes the start of that week, not only
  the start of the month
