Feature: Hours from logged seconds
  GitLab reports time tracking as a whole number of seconds. Every hour figure
  the dashboard shows derives from this single conversion, so its rounding
  behaviour is a business rule rather than a formatting detail.

  # Spec: personal-timelog-report / REQ-2
  Scenario Outline: Converting a logged duration to hours
    Given a timelog of <seconds> seconds
    When the duration is converted to hours
    Then the result is <hours> hours

    Examples:
      | seconds | hours |
      | 0       | 0     |
      | 3600    | 1     |
      | 28800   | 8     |
      | 1800    | 0.5   |
      | 24120   | 6.7   |
      | 100     | 0.03  |
      | -3600   | -1    |

  # Spec: personal-timelog-report / REQ-2
  Scenario: Rejecting a duration that is not a number
    Given a timelog of an unknown duration
    When the duration is converted to hours
    Then the conversion is rejected as invalid
