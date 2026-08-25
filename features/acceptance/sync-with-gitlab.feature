Feature: Syncing with GitLab
  The figures on screen arrived from GitLab at some point, and the reader is the
  one who knows when that stopped being good enough — they have just logged time
  in GitLab and come back to this tab. So the screen says when the hours
  arrived, and one control asks for them again, whether the last attempt merely
  grew old or failed outright.

  # Spec: dashboard-ui / UI-14
  Scenario: The dashboard says when the hours arrived
    Given I am signed in
    Then the report says when it last synced

  # Spec: dashboard-ui / UI-13
  Scenario: Asking GitLab for the hours again
    Given I am signed in
    When I sync with GitLab
    Then GitLab was asked for the hours again
    And today reads 6.5 hours

  # Spec: dashboard-ui / UI-13
  # Spec: personal-timelog-report / REPORT-9
  Scenario: Retrying a failure from the same control
    Given GitLab cannot be reached
    When I sign in
    Then I am told GitLab could not be reached
    And I am offered a retry
    When I sync with GitLab
    Then GitLab was asked for the hours again
