Feature: Keeping a team
  A team is a list of people the reader keeps, and the month of hours is about
  that list and nothing else. So this is where one is made: built from a GitLab
  group in one action, corrected a person at a time, and held somewhere the
  reader's next device can read back — which also means a change that did not
  reach that store has to say so rather than sit on screen looking saved.

  Edits are collected and written once, when the reader saves them. So every
  scenario below that expects the store to have heard about something says when,
  and the ones that expect it not to are the point of the change: removing a
  colleague used to be final the moment it was clicked.

  It is edited over the report rather than instead of it. A reader notices a team
  is wrong while reading its month, and that list has no address worth sending
  anybody, so leaving the figures to fix the list they are about buys nothing.

  # Spec: saved-teams / TEAM-1
  Scenario: Starting a second team and naming it
    Given I am signed in
    When I open my teams
    And I start a new team
    And I name it "Squad Tributário"
    And I save my teams
    Then I keep the teams "Squad Fiscal" and "Squad Tributário"
    And the screen says the change was saved

  # Spec: saved-teams / TEAM-1
  Scenario: Putting somebody on a team, and taking somebody off
    Given I am signed in
    When I open my teams
    And I look for "Diego" by name
    And I add "Diego Alves" from the search results
    Then the team lists "Diego Alves"
    When I take "Ana Carolina" off the team
    And I save my teams
    Then the team does not list "Ana Carolina"

  # Spec: saved-teams / TEAM-1
  Scenario: Editing a team without leaving the month
    Given I am signed in
    When I open the report for my team in "2026-05"
    And I open my teams from the report
    And I take "Ana Carolina" off the team
    And I save my teams
    And I close my teams
    Then the table has no row heading for "Ana Carolina"
    And the month shown is May 2026

  # Spec: saved-teams / TEAM-1
  Scenario: A whole squad, in one action
    Given I am signed in
    When I open my teams
    And I build a team from the group "squad-fiscal"
    And I save my teams
    Then the team lists "Ana Carolina"
    And the team lists "Diego Alves"
    And the screen says the change was saved

  # Spec: team-timelog-report / GROUP-15
  Scenario: The team is whoever logged time, not whoever has access
    Given I am signed in
    When I open my teams
    And I build a team from the group "squad-fiscal"
    Then the team lists "Ana Carolina"
    And the team lists "Diego Alves"
    And the team does not list "Bruno Teixeira"

  # Spec: team-timelog-report / GROUP-15
  Scenario: Anybody the group missed is found by name
    Given I am signed in
    When I open my teams
    And I start a new team
    And I look for "Diego" by name
    Then the search offers "Diego Alves"


  # Spec: team-timelog-report / GROUP-15
  Scenario: A bot that logged time is not put on the team
    Given I am signed in
    When I open my teams
    And I build a team from the group "squad-fiscal"
    Then the team lists "Diego Alves"
    And the team does not list "Release Bot"

  # Spec: team-timelog-report / GROUP-15
  Scenario: An account that is no longer active logged time, and is still put on
    Given I am signed in
    When I open my teams
    And I build a team from the group "squad-fiscal"
    Then the team lists "Helena Prado"

  # Spec: team-timelog-report / GROUP-15
  Scenario: Adding a group to a team takes nobody off it
    Given I am signed in
    When I open my teams
    And I add the group "squad-fiscal" to this team
    Then the team lists "Diego Alves"
    And the team lists "Bruno Teixeira"
    And the team lists "Ana Carolina" once

  # Spec: team-timelog-report / GROUP-15
  Scenario: A seeded team is not a subscription
    Given I am signed in
    When I open my teams
    And I add the group "squad-fiscal" to this team
    And I save my teams
    And "Diego Alves" stops logging time in that group
    And I open my teams again
    Then the team lists "Diego Alves"
    When I open the report for my team in "2026-05"
    Then the table has a row heading for "Diego Alves"
    And the row for "Diego Alves" totals "0" hours

  # Spec: saved-teams / TEAM-2
  Scenario: A team is read back from the store, and nobody's name is left behind
    Given I am signed in
    When I open my teams
    And I look for "Diego" by name
    And I add "Diego Alves" from the search results
    And I save my teams
    And I open my teams again
    Then the team lists "Diego Alves"
    And nobody on the team is named anywhere on this device

  # Spec: saved-teams / TEAM-2
  Scenario: A store that will not answer lists nothing rather than a list it cannot vouch for
    Given I am signed in
    And my teams cannot be read from the store
    When I open my teams
    Then the screen says my teams could not be loaded
    And no team is listed

  # Spec: saved-teams / TEAM-4
  Scenario: A change the store would not take is still there to try again
    Given I am signed in
    And the store will not accept a change
    When I open my teams
    And I take "Ana Carolina" off the team
    And I save my teams
    Then the screen says the change was not saved
    # Still on screen: nothing was stored, so what the reader edited is still
    # true, and trying again should not mean doing it again.
    And the team does not list "Ana Carolina"
    # And the store kept the team it had, which is what the reload proves.
    When I open my teams again
    Then the team lists "Ana Carolina"

  # Spec: saved-teams / TEAM-4
  Scenario: A change that was not saved is not tried again later
    Given I am signed in
    And the store will not accept a change
    When I open my teams
    And I take "Ana Carolina" off the team
    And I save my teams
    And I open my teams again
    Then the team lists "Ana Carolina"
    And nothing was written to the store a second time

  # Spec: saved-teams / TEAM-5
  Scenario: A change made against a version another device replaced is refused
    Given I am signed in
    And my teams were changed on another device
    When I open my teams
    And I take "Ana Carolina" off the team
    And I save my teams
    Then the screen says the team was changed somewhere else
    And the team lists "Ana Carolina"

  # Spec: gitlab-authentication / AUTH-11
  Scenario: A session granted before the identity scope keeps its place
    Given my session predates the permission to identify me
    When I open my teams
    Then the screen says permission to identify me is needed, and offers a fresh sign-in
    When I close my teams
    Then I am still signed in

  # Spec: saved-teams / TEAM-1
  Scenario: An edit is not stored until it is saved
    Given I am signed in
    When I open my teams
    And I take "Ana Carolina" off the team
    Then the team does not list "Ana Carolina"
    And nothing was written to the store

  # Spec: saved-teams / TEAM-1
  Scenario: Discarding puts the team back
    Given I am signed in
    When I open my teams
    And I take "Ana Carolina" off the team
    And I discard my teams
    Then the team lists "Ana Carolina"
    And nothing was written to the store

  # Spec: saved-teams / TEAM-1
  Scenario: Closing with edits that were not saved asks first
    Given I am signed in
    When I open my teams
    And I take "Ana Carolina" off the team
    And I try to close my teams
    Then I am asked about the changes I did not save
    And nothing was written to the store
