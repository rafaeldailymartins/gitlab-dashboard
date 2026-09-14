Feature: Hours the provider did not show
  GitLab removes the entries a reader may not read from its answer without an
  error and without a gap, while separately reporting how many exist. The
  difference between the two is the only thing that can see the removal — and a
  figure beside a colleague's name is one somebody makes a decision about.

  # Spec: group-timelog-report / GROUP-8
  Scenario: The provider counted more than it showed
    Given the provider reports "10" entries totalling "40h" for the month
    And the reader was shown "8" entries totalling "32h"
    Then the report says "2" entries and "8" hours are missing

  # Spec: group-timelog-report / GROUP-8
  Scenario: The figures on screen are higher than the provider's own total
    Given the provider reports "9" entries totalling "28h" for the month
    And the reader was shown "8" entries totalling "32h"
    Then the report says the figures may be too high by "4" hours

  # Spec: group-timelog-report / GROUP-8
  Scenario: Nothing was withheld
    Given the provider reports "8" entries totalling "32h" for the month
    And the reader was shown "8" entries totalling "32h"
    Then the report says nothing is missing

  # Spec: group-timelog-report / GROUP-8
  Scenario: Nothing is claimed while the month is still being read
    Given the provider reports "10" entries totalling "40h" for the month
    And the month has not been read in full
    Then the report makes no claim about what is missing

  # Spec: group-timelog-report / GROUP-9
  Scenario: A shortfall belongs to the row it came from
    Given a group whose members are "Ana, Bruno"
    And the provider reports "58h" for "Ana"
    And "Ana" was shown "46h"
    Then the row for "Ana" is short by "12" hours
    And the row for "Bruno" reports no shortfall

  # Spec: group-timelog-report / GROUP-9
  Scenario: A person whose whole month is unreadable is not a person who logged nothing
    Given a group whose members are "Ana, Bruno"
    And the provider reports "58h" for "Ana"
    And "Ana" was shown "0h"
    Then the row for "Ana" is short by "58" hours
    And the row for "Ana" holds no visible hours
    And the row for "Bruno" reports no shortfall

  # Spec: group-timelog-report / GROUP-9
  Scenario: Hours logged just outside the month are not hours withheld
    Given a group whose members are "Ana"
    And the provider reports "8h" for "Ana"
    And "Ana" logged "8h" on the day before the month began
    Then the row for "Ana" reports no shortfall
    And the row for "Ana" holds no visible hours
