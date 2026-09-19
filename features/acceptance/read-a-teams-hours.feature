Feature: Reading a team's hours
  A lead opens a team they keep — Ana, who logged six and a half hours in May,
  four and a half of them inside squad-fiscal, and Bruno, who logged none — and
  reads a month of it per person per day.

  The report they had before could only say that one group held nothing for
  somebody. This one can say they logged nothing anywhere, and every scenario
  below that touches an empty cell is about which of those two it is entitled to
  claim.

  Those two figures of Ana's are what the group filter is for. It changes every
  number on the screen and changes nothing about how the screen looks, so 6.5 and
  4.5 are drawn identically and differ only in what they mean — which is why the
  screen has to say which of them the reader is looking at, and why a link that
  dropped the filter would send a report that is not the one being read.

  Background:
    Given I am signed in

  # Spec: group-timelog-report / GROUP-14
  Scenario: Opening a report by its address
    When I open the report for my team in "2026-05"
    Then the team shown is "Squad Fiscal"
    And the month shown is May 2026

  # Spec: group-timelog-report / GROUP-1
  Scenario: The report says how far its figures reach
    When I open the report for my team in "2026-05"
    Then the screen says the figures cover everywhere these people logged
    And the figures are said to include work this account cannot open

  # Spec: group-timelog-report / GROUP-1
  # Spec: group-timelog-report / GROUP-14
  Scenario: Narrowing the figures to one group
    When I open the report for my team in "2026-05"
    Then the row for "Ana Carolina" totals "6.5" hours
    When I open the group filter
    Then the filter offers the way back to everywhere first
    And the filter offers "squad-fiscal"
    When I choose "squad-fiscal" from the filter
    Then the screen says the figures cover "squad-fiscal" and its subgroups
    And the address narrows to "invent-software/squad-fiscal"
    And the row for "Ana Carolina" totals "4.5" hours

  # Spec: group-timelog-report / GROUP-1
  # Spec: group-timelog-report / GROUP-14
  Scenario: Going back to everywhere puts every figure back
    When I open the report for my team in "2026-05", narrowed to "invent-software/squad-fiscal"
    Then the row for "Ana Carolina" totals "4.5" hours
    When I open the group filter
    And I choose the way back to everywhere
    Then the row for "Ana Carolina" totals "6.5" hours
    And the screen says the figures cover everywhere these people logged
    And the address narrows to nothing

  # Spec: group-timelog-report / GROUP-17
  Scenario: Every cell is reached through its headings
    When I open the report for my team in "2026-05"
    Then the table has a row heading for "Ana Carolina"
    And the table has a column heading for every day of the month
    And no cell of the table is a keyboard stop

  # Spec: group-timelog-report / GROUP-3
  Scenario: Somebody on the team who logged nothing keeps their row
    When I open the report for my team in "2026-05"
    Then the table has a row heading for "Bruno Teixeira"
    And the row for "Bruno Teixeira" totals "0" hours

  # Spec: group-timelog-report / GROUP-7
  Scenario: No figure stands in for a month that has not been read
    Given GitLab will not answer for my team until I let it
    When I open the report for my team in "2026-05", before GitLab answers
    Then space is reserved where the figures go, and no figure is drawn
    When GitLab answers
    Then the row for "Ana Carolina" totals "6.5" hours

  # Spec: group-timelog-report / GROUP-11
  Scenario: The screen states what the marks are measured against
    When I open the report for my team in "2026-05"
    Then the legend states the reference the bars are measured against

  # Spec: group-timelog-report / GROUP-11
  Scenario: The key explains only the marks the table actually uses
    When I open the report for my team in "2026-05"
    Then the legend does not explain a mark the table has none of

  # Spec: group-timelog-report / GROUP-12
  Scenario: Switching the columns to whole weeks
    When I open the report for my team in "2026-05"
    And I switch the columns to weeks
    Then the address says the columns are weeks

  # Spec: group-timelog-report / GROUP-16
  Scenario: Ordering the rows by hours
    When I open the report for my team in "2026-05"
    And I order the rows by total
    Then the total heading reports the ordering

  # Spec: group-timelog-report / GROUP-5
  Scenario: An empty day says nobody logged anywhere, when nothing narrows it
    When I open the report for my team in "2026-05"
    Then an empty working day is spoken as no hours logged anywhere
    And the key explains the empty-day mark as nothing logged anywhere

  # Spec: group-timelog-report / GROUP-5
  Scenario: An empty day says the group holds no hours, not that nobody worked
    When I open the report for my team in "2026-05", narrowed to "invent-software/squad-fiscal"
    Then an empty working day is spoken as holding no hours in this group
    And no cell claims that anybody logged nothing at all
    And the key explains the empty-day mark as nothing in this group

  # Spec: group-timelog-report / GROUP-5
  Scenario: A day in a month that could not be read in full
    Given GitLab is holding some of my team's hours back
    And GitLab will not say which day it held them back from
    When I open the report for my team in "2026-05"
    Then an empty day in the row for "Ana Carolina" is spoken as nothing here that can be read
    And no cell in the row for "Ana Carolina" says they logged nothing

  # Spec: group-timelog-report / GROUP-5
  Scenario: A day in a month that could not be read in full, narrowed to one group
    Given GitLab is holding some of my team's hours back
    And GitLab will not say which day it held them back from
    When I open the report for my team in "2026-05", narrowed to "invent-software/squad-fiscal"
    Then an empty day in the row for "Ana Carolina" is spoken as nothing in this group that can be read
    And no cell in the row for "Ana Carolina" says they logged nothing

  # Spec: group-timelog-report / GROUP-19
  Scenario: Withheld hours are added into the figures rather than left out
    Given GitLab is holding some of my team's hours back
    When I open the report for my team in "2026-05", narrowed to "invent-software/squad-fiscal"
    Then the row for "Ana Carolina" totals "7" hours

  # Spec: group-timelog-report / GROUP-19
  Scenario: At the whole reach they are declared rather than placed
    Given GitLab is watching for a column probe
    And GitLab is holding some of my team's hours back
    When I open the report for my team in "2026-05"
    Then the row for "Ana Carolina" totals "6.5" hours
    And the row for "Ana Carolina" says hours of theirs are missing
    And GitLab is never asked which day they fell on

  # Spec: group-timelog-report / GROUP-10
  Scenario: What is missing is said beside the figures, not beside the button
    Given GitLab is holding some of my team's hours back
    And GitLab will not say which day it held them back from
    When I open the report for my team in "2026-05"
    Then the row for "Ana Carolina" says hours of theirs are missing
    And the sync control says only when the hours arrived

  # Spec: group-timelog-report / GROUP-20
  Scenario: The report opens on the team I chose last time
    When I open the report for my team in "2026-05"
    And I switch the columns to weeks
    And I open the report with no team named
    Then the address names the team I chose

  # Spec: group-timelog-report / GROUP-20
  Scenario: The group I narrowed to is not carried into the next visit
    When I open the report for my team in "2026-05"
    And I open the group filter
    And I choose "squad-fiscal" from the filter
    And I open the report for my team in "2026-05"
    Then the address narrows to nothing
    And the screen says the figures cover everywhere these people logged

  # Spec: group-timelog-report / GROUP-14
  Scenario: A link narrowing to a group I cannot open drops the narrowing
    Given the group my link narrows to is one I cannot open
    When I open the report for my team in "2026-05", narrowed to "invent-software/squad-fiscal"
    Then the screen says the narrowing was dropped
    And the screen says the figures cover everywhere these people logged
    And the row for "Ana Carolina" totals "6.5" hours

  # Spec: group-timelog-report / GROUP-21
  Scenario: A member GitLab does not recognise keeps a row and no figure
    Given my team names somebody GitLab will not resolve
    When I open the report for my team in "2026-05"
    Then the table has a row heading for "Diego Alves"
    And the row for "Diego Alves" says GitLab did not recognise them
    And every cell of the row for "Diego Alves" says nothing is known
    And the team total is still "6.5" hours

  # Spec: group-timelog-report / GROUP-18
  Scenario: Somebody else's hours and names are not left on the device
    Given my own hours have reached the device
    When I open the report for my team in "2026-05"
    Then nothing about my team is written to the device

  # Spec: group-timelog-report / GROUP-18
  Scenario: Signing out takes the report off the device with it
    Given my own hours have reached the device
    When I open the report for my team in "2026-05"
    And I sign out
    Then I am asked to sign in
    And my own hours are gone from the device
    And no team, no roster and no figure is left on the device
