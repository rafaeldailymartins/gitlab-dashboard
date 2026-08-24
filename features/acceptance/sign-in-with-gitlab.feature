Feature: Signing in with GitLab
  Nobody pastes a token into this dashboard. A reader signs in with their own
  GitLab account, and the callback is verified as belonging to an attempt this
  application started.

  # Spec: gitlab-authentication / AUTH-8
  Scenario: A reader without a session is asked to sign in
    When I open the dashboard
    Then I am asked to sign in
    And there is nowhere to paste a token
    And there is no navigation and no way to sign out

  # Spec: gitlab-authentication / AUTH-8
  Scenario: A reader who already has a session never sees the sign-in screen
    Given I am signed in
    When I open the sign-in screen
    Then I see the dashboard

  # Spec: gitlab-authentication / AUTH-1
  Scenario: Signing in reaches the dashboard
    Given GitLab will authorise this application
    When I open the dashboard
    And I continue with GitLab
    Then I see the dashboard

  # Spec: gitlab-authentication / AUTH-9
  Scenario: Declining is explained rather than failing silently
    Given GitLab will refuse to authorise this application
    When I open the dashboard
    And I continue with GitLab
    Then I am told the sign-in did not complete
    And I am offered another attempt

  # Spec: gitlab-authentication / AUTH-8
  Scenario: A deep link survives the round trip to GitLab
    Given GitLab will authorise this application
    When I open the "settings" screen
    And I continue with GitLab
    Then I am on the settings page

  # Spec: gitlab-authentication / AUTH-6
  Scenario: Signing out leaves nothing behind
    Given I am signed in
    When I sign out
    Then I am asked to sign in
    And no credential remains on the device

  # Spec: gitlab-authentication / AUTH-7
  Scenario: The application asks for read-only authority
    Given GitLab will authorise this application
    When I open the dashboard
    And I continue with GitLab
    Then GitLab was asked for the read_api scope and no other

  # Spec: gitlab-authentication / AUTH-3
  Scenario: The access credential is never written to the device
    Given I am signed in
    Then no access token is anywhere on this device

  # Spec: gitlab-authentication / AUTH-4
  Scenario: The session survives leaving and coming back
    Given I am signed in
    When I come back to the dashboard
    Then I see the dashboard

  # Spec: gitlab-authentication / AUTH-5
  Scenario: A credential about to expire is renewed without being noticed
    Given GitLab will authorise this application, with a credential that expires at once
    When I open the dashboard
    And I continue with GitLab
    Then I see the dashboard
    And the credential was renewed
