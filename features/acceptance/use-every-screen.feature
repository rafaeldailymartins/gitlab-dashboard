Feature: Using every screen
  A reader who navigates with a keyboard, a screen reader or a phone has to be
  able to use all of it, in either colour scheme — not just the screen that
  happened to be checked.

  # Spec: dashboard-ui / UI-8
  Scenario Outline: Every screen is free of accessibility violations
    Given my system prefers the <scheme> colour scheme
    And I am signed in
    When I open the "<screen>" screen
    Then the page has no accessibility violations

    Examples:
      | screen    | scheme |
      | dashboard | light  |
      | dashboard | dark   |
      | insights  | light  |
      | insights  | dark   |
      | settings  | light  |
      | settings  | dark   |
      | a day     | light  |
      | a day     | dark   |
      | team      | light  |
      | team      | dark   |

  # Spec: dashboard-ui / UI-11
  Scenario Outline: No screen scrolls sideways on a phone
    Given my viewport is 375 pixels wide
    And I am signed in
    When I open the "<screen>" screen
    Then the page does not scroll sideways

    Examples:
      | screen    |
      | dashboard |
      | insights  |
      | settings  |
      | a day     |
      | team      |

  # Spec: dashboard-ui / UI-16
  Scenario Outline: The navigation says which screen I am on
    Given I am signed in
    When I open the "<screen>" screen
    Then the navigation marks "<screen>" as the screen I am on

    Examples:
      | screen    |
      | dashboard |
      | insights  |
      | settings  |
      | team      |

  # Spec: dashboard-ui / UI-11
  Scenario: The sign-in screen does not scroll sideways on a phone either
    Given my viewport is 375 pixels wide
    When I open the dashboard
    Then I am asked to sign in
    And the page does not scroll sideways

  # Spec: dashboard-ui / UI-8
  Scenario: The dashboard is operable with a keyboard alone
    Given I am signed in
    Then I can reach every control by keyboard, each showing where focus is
