Feature: A team's month as a matrix
  People down, columns across. The rows are the team exactly — the people the
  reader chose, nobody else — so the person who logged nothing, the one a lead
  opens this screen to find, has a row like everybody else.

  # Spec: team-timelog-report / GROUP-3
  Scenario: Somebody who logged nothing still has a row
    Given a team of "Ana, Bruno and Camila"
    And "Ana" logged "2h on 2026-05-04"
    Then the matrix has rows for "Ana, Bruno and Camila"
    And the row for "Bruno" holds no visible entries

  # Spec: team-timelog-report / GROUP-3
  Scenario: Somebody who logged time but is not on the team gets no row
    Given a team of "Ana"
    And "Diego" logged "3h on 2026-05-04"
    Then the matrix has rows for "Ana"

  # Spec: team-timelog-report / GROUP-3
  Scenario: The rows are drawn in the order the team names them
    Given a team of "Camila, Ana"
    Then the matrix rows are in the order "Camila, Ana"

  # Spec: team-timelog-report / GROUP-4
  Scenario: Two entries on the same day are one cell
    Given a team of "Ana"
    And "Ana" logged "2h on 2026-05-04"
    And "Ana" also logged "1h30m on 2026-05-04"
    Then the cell for "Ana" on "2026-05-04" reads "3.5" hours

  # Spec: team-timelog-report / GROUP-4
  Scenario: A day whose entries cancel out is not a day with none
    Given a team of "Ana"
    And "Ana" logged "2h on 2026-05-04"
    And "Ana" also logged "-2h on 2026-05-04"
    Then the cell for "Ana" on "2026-05-04" reads "0" hours
    And the cell for "Ana" on "2026-05-04" counts "2" entries

  # Spec: team-timelog-report / GROUP-5
  Scenario Outline: Each kind of empty cell says which kind it is
    Given a team of "Ana"
    And Ana's month has been read up to <read>
    And today is <today>
    Then the cell for Ana on <date> is "<kind>"

    Examples:
      | read       | today      | date       | kind        |
      | 2026-05-31 | 2026-06-15 | 2026-05-04 | unlogged    |
      | 2026-05-31 | 2026-06-15 | 2026-05-02 | non-working |
      | 2026-05-31 | 2026-05-12 | 2026-05-20 | future      |
      | 2026-05-12 | 2026-06-15 | 2026-05-20 | pending     |

  # Spec: team-timelog-report / GROUP-21
  Scenario: A stored member the provider does not recognise says nothing about any day
    Given a team of "Ana"
    And GitLab does not recognise "Ana"
    Then every cell for Ana is "unknown"
    And the row for "Ana" holds no visible entries

  # Spec: team-timelog-report / GROUP-7
  Scenario: One person still being read does not hold up another who is finished
    Given a team of "Ana, Bruno"
    And Ana's month has been read up to 2026-05-31
    And Bruno's month has been read up to 2026-05-12
    Then the cell for Ana on 2026-05-20 is "unlogged"
    And the cell for Bruno on 2026-05-20 is "pending"
    And Ana's row total is final
    And Bruno's row total is still pending

  # Spec: team-timelog-report / GROUP-6
  Scenario: The grand total agrees with the rows and with the columns
    Given a team of "Ana, Bruno"
    And "Ana" logged "2h on 2026-05-04"
    And "Bruno" also logged "3h on 2026-05-05"
    Then the grand total equals the sum of the rows
    And the grand total equals the sum of the columns

  # Spec: team-timelog-report / GROUP-13
  Scenario: A month that starts mid-week opens with a short band
    Given a team of "Ana"
    Then the first week band spans "3" columns
    And the first week band is ISO week "18" of "2026"
