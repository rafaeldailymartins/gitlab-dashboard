Feature: A team as a list the reader keeps
  A row per person is how the report is read, so this list is the one thing in
  it that can make a figure wrong: two rows for one person would count their
  hours twice in every total. Which is why adding somebody already on the team
  leaves it exactly as it was, why a document read back from the store is
  deduplicated again before anybody sees it, and why all of that — including
  what the provider is asked when a row needs a face — goes by the identifier
  rather than the handle. A rename releases a handle, and another account may
  claim it.

  The rest is what a damaged document costs and what a ceiling refuses. One
  unreadable member costs the reader that member and not the team; one
  unreadable team costs them that team and not the rest; and a team larger than
  the store would accept is refused here rather than at the end of a round trip.

  # Spec: saved-teams / TEAM-1
  Scenario: Making a team and putting people on it
    Given a team named "Squad Fiscal"
    And the reader adds "Ana"
    And the reader also adds "Bruno"
    Then the team lists "Ana and Bruno"

  # Spec: saved-teams / TEAM-1
  Scenario: Adding somebody already on the team leaves it as it was
    Given a team named "Squad Fiscal"
    And the reader adds "Ana"
    When the reader adds "Ana" again under the name they now go by
    Then the team is the one the reader already had
    And the team lists "Ana"

  # Spec: saved-teams / TEAM-1
  Scenario: Taking somebody off a team
    Given a team named "Squad Fiscal"
    And the reader adds "Ana"
    And the reader also adds "Bruno"
    When the reader takes "Ana" off the team
    Then the team lists "Bruno"

  # Spec: saved-teams / TEAM-1
  Scenario: Renaming a team keeps the identifier an address names
    Given a team named "Squad Fiscal"
    When the reader renames it "Squad Tributário"
    Then the team is named "Squad Tributário"
    And the team's identifier is the one it was made with

  # Spec: saved-teams / TEAM-1
  Scenario: The reader keeps more than one team
    Given a team named "Squad Fiscal"
    And a second team named "Squad Tributário"
    Then the reader keeps the teams "Squad Fiscal and Squad Tributário"

  # Spec: saved-teams / TEAM-1
  Scenario: Deleting one team leaves the rest
    Given a team named "Squad Fiscal"
    And a second team named "Squad Tributário"
    When the reader deletes "Squad Fiscal"
    Then the reader keeps the teams "Squad Tributário"

  # Spec: saved-teams / TEAM-1
  Scenario: The people on a team are read in one order, whatever the reader's locale
    Given a team named "Squad Fiscal"
    And the reader adds "Camila"
    And the reader also adds "Ana"
    And the reader adds somebody who goes by the same name as "Ana"
    Then the team lists the handles "ana.souza, ana.souza.2, camila.vieira"

  # Spec: saved-teams / TEAM-4
  Scenario: A name longer than the store accepts is refused before the round trip
    Given a team named "Squad Fiscal"
    When the reader renames it to something longer than the store accepts
    Then the team is the one the reader already had

  # Spec: saved-teams / TEAM-4
  Scenario: A team refuses to grow past the ceiling it states
    Given a team holding the most people a team may
    When the reader adds "Diego"
    Then the team is the one the reader already had

  # Spec: saved-teams / TEAM-4
  Scenario: The reader's list refuses to grow past the ceiling it states
    Given the most teams a reader may keep
    When the reader starts one more team
    Then the list is the one the reader already had

  # Spec: saved-teams / TEAM-2
  Scenario: One unreadable member costs the reader that member and not the team
    Given a stored team holding "Ana and Bruno" and a fragment that is not a member
    When the teams are read back
    Then the team lists "Ana and Bruno"

  # Spec: saved-teams / TEAM-2
  Scenario: One unreadable team costs the reader that team and not the rest
    Given a stored team named "Squad Fiscal" and a fragment that is not a team
    When the teams are read back
    Then the reader keeps the teams "Squad Fiscal"

  # Spec: saved-teams / TEAM-1
  Scenario: Two stored members sharing an identifier are read back as one
    Given a stored team holding "Ana" twice, the second time under another handle
    When the teams are read back
    Then the team lists "Ana"

  # Spec: group-timelog-report / GROUP-21
  Scenario: A member the provider resolved under another handle is still that member
    Given a team named "Squad Fiscal"
    And the reader adds "Ana"
    When the provider resolves "Ana" under the handle they changed to
    Then "Ana" is confirmed, under the handle the provider now gives

  # Spec: group-timelog-report / GROUP-21
  Scenario: Members are matched by identifier, so a shorter answer misplaces nobody
    Given a team named "Squad Fiscal"
    And the reader adds "Ana"
    And the reader also adds "Bruno"
    When the provider resolves nobody but "Bruno"
    Then "Ana" is unresolved
    And "Bruno" is confirmed

  # Spec: group-timelog-report / GROUP-15
  Scenario: Somebody who logged under two handles is offered once
    Given the people who logged time in the group are "Ana"
    And "Ana" logged there again under the handle they changed to
    Then one person is offered
    And the suggestions offer "Ana"

  # Spec: group-timelog-report / GROUP-15
  Scenario: A bot that logged time is not offered
    Given the people who logged time in the group are "Ana"
    And a bot logged time there too
    Then the suggestions offer "Ana"

  # Spec: group-timelog-report / GROUP-15
  Scenario: Somebody whose account is no longer active is offered all the same
    Given the people who logged time in the group are "Ana"
    And "Diego" logged there before their account stopped being active
    Then the suggestions offer "Ana and Diego"

  # Spec: group-timelog-report / GROUP-15
  Scenario: The suggestions are offered in one order, whatever the reader's locale
    Given the people who logged time in the group are "Camila, Ana and Bruno"
    Then the suggestions offer "Ana, Bruno and Camila"
