Feature: Which day an entry belongs to
  GitLab records an instant; the dashboard shows days. Which day an instant
  falls on depends on the reader's time zone, and getting it wrong moves hours
  from one day to another — the most likely way this product could quietly lie.

  # Spec: personal-timelog-report / REPORT-4
  Scenario Outline: An instant late at night belongs to the day it still was
    Given an entry recorded at "2026-08-21T02:00:00Z"
    When the day is decided in "<zone>"
    Then the entry belongs to <date>

    Examples:
      | zone              | date       |
      | America/Sao_Paulo | 2026-08-20 |
      | UTC               | 2026-08-21 |
      | Asia/Tokyo        | 2026-08-21 |

  # Spec: personal-timelog-report / REPORT-4
  Scenario: An instant in the afternoon can already be tomorrow further east
    Given an entry recorded at "2026-08-20T15:00:00Z"
    When the day is decided in "Asia/Tokyo"
    Then the entry belongs to 2026-08-21

  # Spec: personal-timelog-report / REPORT-4
  Scenario: Two entries share a day in one zone and not in another
    Given an entry recorded at "2026-08-20T15:00:00Z"
    And a second entry recorded at "2026-08-21T02:00:00Z"
    Then they share one day in "America/Sao_Paulo"
    And they fall on different days in "UTC"

  # Spec: personal-timelog-report / REPORT-4
  Scenario: The requested period includes its own edges
    Given entries recorded on 2026-08-18, 2026-08-19, 2026-08-21 and 2026-08-22
    When the period from 2026-08-19 to 2026-08-21 is selected in "America/Sao_Paulo"
    Then only the entries on 2026-08-19 and 2026-08-21 remain
