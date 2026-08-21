Feature: Opening the dashboard
  Every page must render its own content and must be usable by someone
  navigating with a screen reader or a keyboard, in either colour scheme.

  # Spec: dashboard-ui / REQ-1
  Scenario: The dashboard renders
    Given I open the dashboard
    Then I see the page heading
    And the page has no accessibility violations

  # Spec: dashboard-ui / REQ-4
  Scenario Outline: The dashboard is accessible in both colour schemes
    Given my system prefers the <scheme> colour scheme
    When I open the dashboard
    Then the page has no accessibility violations

    Examples:
      | scheme |
      | light  |
      | dark   |
