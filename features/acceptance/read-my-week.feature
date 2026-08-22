Feature: Reading my week
  The reader came to answer three questions: how is this week going, what did I
  do on a given day, and what happened before that.

  # Spec: dashboard-ui / UI-1
  Scenario: The week strip shows each day against its target
    Given I am signed in
    Then the week strip names today with its hours and its target

  # Spec: dashboard-ui / UI-5
  Scenario: Picking a day from the week strip opens it
    Given I am signed in
    When I pick today out of the week strip
    Then I am on a day screen

  # Spec: dashboard-ui / UI-4
  Scenario: A day of the feed opens into what was worked on
    Given I am signed in
    When I open the newest day of the feed
    Then it lists the issue I logged time against

  # Spec: dashboard-ui / UI-10
  Scenario: A work item links back to GitLab
    Given I am signed in
    When I open the newest day of the feed
    Then the issue links to GitLab in a new tab

  # Spec: dashboard-ui / UI-3
  Scenario: The feed says when there is nothing older
    Given I am signed in
    Then the feed says that is the whole history

  # Spec: dashboard-ui / UI-5
  Scenario: A day address survives a reload
    Given I am signed in
    When I reload the day screen for 2026-08-20
    Then I am on the day screen for 2026-08-20
