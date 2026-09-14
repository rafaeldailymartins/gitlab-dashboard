Feature: Reading a group's hours
  A lead opens a group and a month and sees who logged what — and, the part the
  report they had before could never answer, who logged nothing.

  Background:
    Given I am signed in
    And the group "squad-fiscal" has hours logged in it

  # Spec: group-timelog-report / GROUP-14
  Scenario: Opening a report by its address
    When I open the team report for "invent-software/squad-fiscal" in "2026-05"
    Then the report is headed "squad-fiscal"
    And the month shown is May 2026

  # Spec: group-timelog-report / GROUP-1
  Scenario: The report says what it covers
    When I open the team report for "invent-software/squad-fiscal" in "2026-05"
    Then the screen says the figures cover the group and its subgroups

  # Spec: group-timelog-report / GROUP-17
  Scenario: Every cell is reached through its headings
    When I open the team report for "invent-software/squad-fiscal" in "2026-05"
    Then the table has a row heading for "Ana Carolina"
    And the table has a column heading for every day of the month
    And no cell of the table is a keyboard stop

  # Spec: group-timelog-report / GROUP-7
  Scenario: A person with no hours here gets no row, and is not named either
    When I open the team report for "invent-software/squad-fiscal" in "2026-05"
    Then the table has no row for "Bruno Teixeira"
    And nothing on the screen says anybody logged nothing

  # Spec: group-timelog-report / GROUP-11
  Scenario: The screen states what the marks are measured against
    When I open the team report for "invent-software/squad-fiscal" in "2026-05"
    Then the legend states the reference the bars are measured against

  # Spec: group-timelog-report / GROUP-11
  Scenario: The key explains only the marks the table actually uses
    When I open the team report for "invent-software/squad-fiscal" in "2026-05"
    Then the legend does not explain a mark the table has none of

  # Spec: group-timelog-report / GROUP-12
  Scenario: Switching the columns to whole weeks
    When I open the team report for "invent-software/squad-fiscal" in "2026-05"
    And I switch the columns to weeks
    Then the address says the columns are weeks

  # Spec: group-timelog-report / GROUP-16
  Scenario: Ordering the rows by hours
    When I open the team report for "invent-software/squad-fiscal" in "2026-05"
    And I order the rows by total
    Then the total heading reports the ordering

  # Spec: group-timelog-report / GROUP-15
  Scenario: Choosing a group from the picker
    When I open the team report with no group named
    Then the screen asks me to choose a group
    When I open the group picker
    Then the picker offers "squad-fiscal"

  # Spec: group-timelog-report / GROUP-5
  Scenario: An empty day says the group holds no hours, not that nobody worked
    When I open the team report for "invent-software/squad-fiscal" in "2026-05"
    Then an empty working day is spoken as holding no hours in this group
    And no cell claims that anybody logged nothing at all

  # Spec: group-timelog-report / GROUP-19
  Scenario: Withheld hours are added into the figures rather than left out
    Given I am a Guest in that group, and GitLab is holding hours back
    When I open the team report for "invent-software/squad-fiscal" in "2026-05"
    Then the row for "Ana Carolina" totals "9" hours

  # Spec: group-timelog-report / GROUP-20
  Scenario: The report opens on the group I chose last time
    When I open the team report for "invent-software/squad-fiscal" in "2026-05"
    And I switch the columns to weeks
    And I open the team report with no group named
    Then the address names "invent-software/squad-fiscal"

  # Spec: group-timelog-report / GROUP-10
  Scenario: What is missing is said beside the figures, not beside the button
    Given I am a Guest in that group, and GitLab is holding hours back
    When I open the team report for "invent-software/squad-fiscal" in "2026-05"
    Then the sync control says only when the hours arrived

  # Spec: group-timelog-report / GROUP-18
  Scenario: Somebody else's hours are not left on the device
    When I open the team report for "invent-software/squad-fiscal" in "2026-05"
    Then nothing about the group is written to the device
