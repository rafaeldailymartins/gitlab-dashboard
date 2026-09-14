Feature: A group's month as a matrix
  People down, columns across. The rows come from the group's membership rather
  than from the entries, so the person who logged nothing — the one a lead opens
  this screen to find — has a row like everybody else.

  # Spec: group-timelog-report / GROUP-3
  Scenario: A member who logged nothing still has a row
    Given a group whose members are "Ana, Bruno and Camila"
    And "Ana" logged "2h on 2026-05-04"
    Then the matrix has rows for "Ana, Bruno and Camila"
    And the row for "Bruno" holds no visible entries

  # Spec: group-timelog-report / GROUP-3
  Scenario: Somebody who logged time but is not a member keeps their row
    Given a group whose members are "Ana"
    And "Diego" logged "3h on 2026-05-04"
    Then the matrix has rows for "Ana, Diego"
    And the row for "Diego" is not on the membership

  # Spec: group-timelog-report / GROUP-3
  Scenario: A bot on the membership gets no row
    Given a group whose members are "Ana, a bot"
    Then the matrix has rows for "Ana"

  # Spec: group-timelog-report / GROUP-4
  Scenario: Two entries on the same day are one cell
    Given a group whose members are "Ana"
    And "Ana" logged "2h on 2026-05-04"
    And "Ana" also logged "1h30m on 2026-05-04"
    Then the cell for "Ana" on "2026-05-04" reads "3.5" hours

  # Spec: group-timelog-report / GROUP-4
  Scenario: A day whose entries cancel out is not a day with none
    Given a group whose members are "Ana"
    And "Ana" logged "2h on 2026-05-04"
    And "Ana" also logged "-2h on 2026-05-04"
    Then the cell for "Ana" on "2026-05-04" reads "0" hours
    And the cell for "Ana" on "2026-05-04" counts "2" entries

  # Spec: group-timelog-report / GROUP-5
  Scenario Outline: Each kind of empty cell says which kind it is
    Given a group whose members are "Ana"
    And the month has been read up to <read>
    And today is <today>
    Then the cell for Ana on <date> is "<kind>"

    Examples:
      | read       | today      | date       | kind        |
      | 2026-05-31 | 2026-06-15 | 2026-05-04 | unlogged    |
      | 2026-05-31 | 2026-06-15 | 2026-05-02 | non-working |
      | 2026-05-31 | 2026-05-12 | 2026-05-20 | future      |
      | 2026-05-12 | 2026-06-15 | 2026-05-20 | pending     |

  # Spec: group-timelog-report / GROUP-6
  Scenario: The grand total agrees with the rows and with the columns
    Given a group whose members are "Ana, Bruno"
    And "Ana" logged "2h on 2026-05-04"
    And "Bruno" also logged "3h on 2026-05-05"
    Then the grand total equals the sum of the rows
    And the grand total equals the sum of the columns

  # Spec: group-timelog-report / GROUP-13
  Scenario: A month that starts mid-week opens with a short band
    Given a group whose members are "Ana"
    Then the first week band spans "3" columns
    And the first week band is ISO week "18" of "2026"
