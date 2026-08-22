Feature: Daily target and balance
  A full day is whatever the reader's own schedule says it is, not a fixed eight
  hours. Every progress figure in the dashboard is measured against that, so how
  a target is read, changed and compared is a business rule rather than a
  presentation detail.

  Background:
    Given a reader who has not changed their targets

  # Spec: user-preferences / PREF-1
  Scenario Outline: The default working week
    When the target for <weekday> is read
    Then it is <hours> hours

    Examples:
      | weekday  | hours |
      | Monday   | 8     |
      | Friday   | 8     |
      | Saturday | 0     |
      | Sunday   | 0     |

  # Spec: user-preferences / PREF-1
  Scenario: A week's target is the sum of its days
    When the target for a whole week is read
    Then it is 40 hours

  # Spec: user-preferences / PREF-2
  Scenario: Shortening one weekday
    When the target for Friday is set to 6 hours
    Then the target for Friday is 6 hours
    And the target for Monday is still 8 hours
    And the target for a whole week is 38 hours

  # Spec: user-preferences / PREF-2
  Scenario Outline: Refusing a target a day could not hold
    When the target for Monday is set to <hours> hours
    Then the change is refused

    Examples:
      | hours |
      | -1    |
      | 25    |

  # Spec: user-preferences / PREF-1
  Scenario: Time logged on a day with no target counts as above target
    When 2 hours are logged on a Sunday
    Then the balance is 2 hours above target
    And there is no percentage to report
