Feature: Opening the dashboard
  Every screen must render its own content and be usable by someone navigating
  with a screen reader or a keyboard, in either colour scheme.

  # Spec: dashboard-ui / UI-1
  Scenario: The dashboard renders
    Given I am signed in
    Then I see the page heading
    And the page has no accessibility violations

  # Spec: dashboard-ui / UI-2
  Scenario: The summary shows the hours GitLab holds
    Given I am signed in
    Then today reads 6 hours
    And the report says it is up to date

  # Spec: dashboard-ui / UI-4
  Scenario Outline: The dashboard is accessible in both colour schemes
    Given my system prefers the <scheme> colour scheme
    And I am signed in
    Then the page has no accessibility violations

    Examples:
      | scheme |
      | light  |
      | dark   |

  # Spec: gitlab-authentication / AUTH-1
  Scenario Outline: The sign-in screen is accessible in both colour schemes
    Given my system prefers the <scheme> colour scheme
    When I open the dashboard
    Then I am asked to sign in
    And the page has no accessibility violations

    Examples:
      | scheme |
      | light  |
      | dark   |

  # Spec: dashboard-ui / UI-6
  Scenario: The insights screen has no accessibility violations
    Given I am signed in
    When I open the insights page
    Then I am on the insights page
    And the page has no accessibility violations

  # Spec: dashboard-ui / UI-4
  Scenario: The settings screen has no accessibility violations
    Given I am signed in
    When I open the settings page
    Then I am on the settings page
    And the page has no accessibility violations
