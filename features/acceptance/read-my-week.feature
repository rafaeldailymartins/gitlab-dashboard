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

  # Spec: dashboard-ui / UI-6
  Scenario: Insights shows the month, the projects and what took the time
    Given I am signed in
    When I open the "insights" screen
    Then it shows a square for every day of the month
    And it splits the hours by project
    And it lists the work items by hours

  # Spec: dashboard-ui / UI-7
  Scenario: Loaded and empty is not the same as not yet loaded
    Given GitLab has nothing logged for me
    When I sign in
    Then the feed says nothing has been logged yet
    And the summary reads zero rather than waiting

  # Spec: personal-timelog-report / REPORT-9
  Scenario: A failure is explained and can be retried
    Given GitLab cannot be reached
    When I sign in
    Then I am told GitLab could not be reached
    And I am offered a retry
