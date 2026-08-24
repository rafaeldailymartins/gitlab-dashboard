Feature: Aggregating hours by day
  Every figure the dashboard shows comes from this aggregation: a day's total,
  what was worked on inside it, and the total for a period. Getting the rounding
  or the grouping wrong shows the reader the wrong number of hours, which is the
  one thing this product must not do.

  # Spec: personal-timelog-report / REPORT-3
  Scenario: A period total is the sum of what was logged, not of rounded days
    Given three entries of 100 seconds each
    When the period total is calculated
    Then it is 0.08 hours
    And it is not 0.09 hours

  # Spec: personal-timelog-report / REPORT-2
  Scenario: A correction subtracts from the total
    Given an entry of 7200 seconds and a correction of -3600 seconds
    When the period total is calculated
    Then it is 1 hours

  # Spec: personal-timelog-report / REPORT-5
  Scenario: Two entries on the same issue on the same day are one row
    Given two entries on issue "group/project#128" on the same day
    When the day is aggregated
    Then it has one work item
    And that work item counts both entries

  # Spec: personal-timelog-report / REPORT-5
  Scenario: A day lists what was worked on, busiest first
    Given an entry of 1800 seconds on issue "group/project#127"
    And an entry of 24120 seconds on issue "group/project#128"
    When the day is aggregated
    Then the first work item is "group/project#128"
    And the day total equals the sum of its work items

  # Spec: personal-timelog-report / REPORT-7
  Scenario: Time logged without an issue still counts
    Given an entry of 3600 seconds with no work item
    When the day is aggregated
    Then the day total is 1 hours
    And the day shows it as unattributed
