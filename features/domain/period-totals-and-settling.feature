Feature: Period totals, and knowing when one is final
  History is read newest first, so today, this week and this month are answered
  by the first response. A period whose start has not been reached yet is a
  floor, not an answer, and saying otherwise would understate the reader's hours
  — the one thing this product must never do.

  # Spec: personal-timelog-report / REPORT-3
  Scenario: A period total covers only the days inside it
    Given a loaded page with 2 hours on 2026-08-20 and 3 hours on 2026-09-02
    When August 2026 is totalled
    Then the total is 2 hours

  # Spec: personal-timelog-report / REPORT-3
  Scenario: A period total is final once history reaches past its start
    Given a loaded page with 2 hours on 2026-08-20 and 3 hours on 2026-07-30
    And there is older history still to load
    When August 2026 is totalled
    Then the total is settled

  # Spec: personal-timelog-report / REPORT-3
  Scenario: A period total is a floor while its start has not been reached
    Given a loaded page with 2 hours on 2026-08-20
    And there is older history still to load
    When August 2026 is totalled
    Then the total is not settled

  # Spec: personal-timelog-report / REPORT-3
  Scenario: A period total is final once there is nothing older anywhere
    Given a loaded page with 2 hours on 2026-08-20
    And there is nothing older to load
    When August 2026 is totalled
    Then the total is settled

  # Spec: personal-timelog-report / REPORT-6
  Scenario: A day split across two pages is one day
    Given a first page with 2 hours on 2026-08-20 and a second with 1 hour on the same day
    When the report is read
    Then it has one day of 3 hours
