Feature: Coming back to the dashboard
  The point of the rebuild is that the app is already there when the reader
  arrives. A return visit has to paint the last figures before it asks GitLab
  anything, and it has to forget them when the reader signs out.

  # Spec: personal-timelog-report / REPORT-8
  Scenario: The last figures are on screen before GitLab answers
    Given I am signed in
    And my hours have been kept on this device
    And GitLab has become slow to answer
    When I come back to the dashboard
    Then today reads 6 hours before the request has finished
    And GitLab was not asked again

  # Spec: gitlab-authentication / AUTH-6
  Scenario: Signing out forgets the figures
    Given I am signed in
    And my hours have been kept on this device
    And GitLab has become slow to answer
    When I sign out
    And I continue with GitLab
    Then today is still loading

  # Spec: dashboard-ui / UI-9
  Scenario: Loading does not move the page
    Given I am signed in
    Then the dashboard settled without shifting its layout

  # Spec: dashboard-ui / UI-9
  Scenario: A return visit does not move the page either
    Given I am signed in
    And my hours have been kept on this device
    When I come back to the dashboard
    Then the dashboard settled without shifting its layout
