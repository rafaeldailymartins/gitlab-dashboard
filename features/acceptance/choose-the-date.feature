Feature: Choosing the date on screen
  The dashboard answers about today and insights about this month until the
  reader asks about another day or another month. Either choice lives in the
  address, so a reload keeps it and a link carries it.

  # Spec: dashboard-ui / UI-17
  Scenario: Stepping back a day reads the dashboard as of that day
    Given I am signed in
    When I step the dashboard back one day
    Then the chosen day reads 3 hours
    And the address names yesterday

  # Spec: dashboard-ui / UI-17
  Scenario: Picking a day from the calendar
    Given I am signed in
    When I pick yesterday from the day picker
    Then the chosen day reads 3 hours
    And the address names yesterday

  # Spec: dashboard-ui / UI-17
  Scenario: A chosen day survives a reload
    Given I am signed in
    When I reload the dashboard as of 40 days ago
    Then the chosen day reads 4 hours

  # Spec: dashboard-ui / UI-17
  Scenario: Going back to today
    Given I am signed in
    When I reload the dashboard as of 40 days ago
    And I go back to today
    Then today reads 6.5 hours
    And the address names no day

  # Spec: dashboard-ui / UI-17
  Scenario: An address that does not name a day reads as today
    Given I am signed in
    When I open the dashboard at an address naming the day "yesterday"
    Then today reads 6.5 hours

  # Spec: dashboard-ui / UI-8
  Scenario: The dashboard read as of an earlier day is accessible
    Given I am signed in
    When I reload the dashboard as of 40 days ago
    Then the chosen day reads 4 hours
    And the page has no accessibility violations

  # Spec: dashboard-ui / UI-18
  Scenario: Stepping insights back a month
    Given I am signed in
    When I open the "insights" screen
    And I step insights back one month
    Then insights names the month before this one
    And the address names the month before this one

  # Spec: dashboard-ui / UI-18
  Scenario: A chosen month survives a reload
    Given I am signed in
    When I reload insights for the month of 40 days ago
    Then the split by project holds 4 hours

  # Spec: dashboard-ui / UI-18
  Scenario: Going back to the current month
    Given I am signed in
    When I reload insights for the month of 40 days ago
    And I go back to the current month
    Then insights names the current month
    And the address names no month
