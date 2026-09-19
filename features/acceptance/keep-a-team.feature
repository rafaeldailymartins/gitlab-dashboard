Feature: Keeping a team
  A team is a list of people the reader keeps, and the month of hours is about
  that list and nothing else. So this is where one is made: named, added to a
  person at a time, and held somewhere the reader's next device can read back —
  which also means a change that did not reach that store has to say so rather
  than sit on screen looking saved.

  # Spec: saved-teams / TEAM-1
  Scenario: Starting a second team and naming it
    Given I am signed in
    When I open the teams screen
    And I start a new team
    And I name it "Squad Tributário"
    Then I keep the teams "Squad Fiscal" and "Squad Tributário"
    And the screen says the change was saved

  # Spec: saved-teams / TEAM-1
  Scenario: Putting somebody on a team, and taking somebody off
    Given I am signed in
    When I open the teams screen
    And I look for "Diego" by name
    And I add "Diego Alves" from the search results
    Then the team lists "Diego Alves"
    When I take "Ana Carolina" off the team
    Then the team does not list "Ana Carolina"

  # Spec: saved-teams / TEAM-1
  Scenario: Somebody already on the team is not offered a second time
    Given I am signed in
    When I open the teams screen
    And I suggest people from the group "squad-fiscal"
    Then the suggestions offer "Diego Alves"
    And the suggestions do not offer "Ana Carolina"
    And the team lists "Ana Carolina" once

  # Spec: team-timelog-report / GROUP-15
  Scenario: The suggestions are whoever logged time, and anybody else is found by name
    Given I am signed in
    When I open the teams screen
    And I start a new team
    And I suggest people from the group "squad-fiscal"
    Then the suggestions offer "Ana Carolina"
    And the suggestions offer "Diego Alves"
    And the suggestions do not offer "Bruno Teixeira"
    And the suggestions say how far back they look
    When I look for "Diego" by name
    Then the search offers "Diego Alves"

  # Spec: team-timelog-report / GROUP-15
  Scenario: A bot that logged time is not offered
    Given I am signed in
    When I open the teams screen
    And I start a new team
    And I suggest people from the group "squad-fiscal"
    Then the suggestions offer "Diego Alves"
    And the suggestions do not offer "Release Bot"

  # Spec: team-timelog-report / GROUP-15
  Scenario: An account that is no longer active logged time, and is still offered
    Given I am signed in
    When I open the teams screen
    And I start a new team
    And I suggest people from the group "squad-fiscal"
    Then the suggestions offer "Helena Prado"
    And the suggestions say "Helena Prado" is no longer active

  # Spec: team-timelog-report / GROUP-15
  Scenario: A suggestion is not a subscription
    Given I am signed in
    When I open the teams screen
    And I suggest people from the group "squad-fiscal"
    And I add "Diego Alves" from the suggestions
    And "Diego Alves" stops logging time in that group
    And I open the teams screen again
    Then the team lists "Diego Alves"
    When I open the report for my team in "2026-05"
    Then the table has a row heading for "Diego Alves"
    And the row for "Diego Alves" totals "0" hours

  # Spec: saved-teams / TEAM-2
  Scenario: A team is read back from the store, and nobody's name is left behind
    Given I am signed in
    When I open the teams screen
    And I look for "Diego" by name
    And I add "Diego Alves" from the search results
    And I open the teams screen again
    Then the team lists "Diego Alves"
    And nobody on the team is named anywhere on this device

  # Spec: saved-teams / TEAM-2
  Scenario: A store that will not answer lists nothing rather than a list it cannot vouch for
    Given I am signed in
    And my teams cannot be read from the store
    When I open the teams screen
    Then the screen says my teams could not be loaded
    And no team is listed

  # Spec: saved-teams / TEAM-4
  Scenario: A change the store would not take leaves the team as it was
    Given I am signed in
    And the store will not accept a change
    When I open the teams screen
    And I take "Ana Carolina" off the team
    Then the screen says the change was not saved
    And the team lists "Ana Carolina"

  # Spec: saved-teams / TEAM-4
  Scenario: A change that was not saved is not tried again later
    Given I am signed in
    And the store will not accept a change
    When I open the teams screen
    And I take "Ana Carolina" off the team
    And I open the teams screen again
    Then the team lists "Ana Carolina"
    And nothing was written to the store a second time

  # Spec: saved-teams / TEAM-5
  Scenario: A change made against a version another device replaced is refused
    Given I am signed in
    And my teams were changed on another device
    When I open the teams screen
    And I take "Ana Carolina" off the team
    Then the screen says the team was changed somewhere else
    And the team lists "Ana Carolina"

  # Spec: gitlab-authentication / AUTH-11
  Scenario: A session granted before the identity scope keeps its place
    Given my session predates the permission to identify me
    When I open the teams screen
    Then the screen says permission to identify me is needed, and offers a fresh sign-in
    And I am still signed in
