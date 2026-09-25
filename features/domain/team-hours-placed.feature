Feature: Putting withheld hours on the day they belong to
  The entries GitLab removes are unrecoverable — no id, no date, no gap where
  they were. What survives is the aggregate, and an aggregate asked one day at a
  time says which day. So the hours can be placed even though the entries
  cannot be read, and the screen's job is to say which is which.

  # Spec: team-timelog-report / GROUP-19
  Scenario: Withheld hours land on the day the provider counted them
    Given "Ana" was shown "6h" on the 4th and nothing on the 12th
    And the provider declares "6h" on the 4th and "3h" on the 12th
    Then the cell for the 12th reads "3" hours
    And the row records "3" hours placed
    And the cell for the 4th is unchanged

  # Spec: team-timelog-report / GROUP-19
  Scenario: Every total is rebuilt from the figures shown
    Given "Ana" was shown "6h" on the 4th and nothing on the 12th
    And the provider declares "6h" on the 4th and "3h" on the 12th
    Then the row totals "9" hours
    And the grand total equals the sum of the rows

  # Spec: team-timelog-report / GROUP-19
  Scenario: Spans that do not tile the period are refused
    Given "Ana" was shown "6h" on the 4th and nothing on the 12th
    And the provider declares a period holding more entries than its days do
    Then nothing is placed on any day
    And the row still reports what is missing without saying where

  # Spec: team-timelog-report / GROUP-19
  Scenario: A day the provider counted and showed nothing of
    Given "Ana" was shown nothing all month
    And the provider declares "8h" on the 12th
    Then the cell for the 12th reads "8" hours
    And the row records "8" hours placed
