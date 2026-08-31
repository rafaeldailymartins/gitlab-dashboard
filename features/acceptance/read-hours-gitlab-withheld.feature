Feature: Reading hours GitLab would not fully report
  GitLab withholds a whole timelog when it cannot resolve the project the time
  was logged in. A reader of the deployed dashboard saw an empty screen and
  "GitLab refused the request" because of three such entries out of twenty-five;
  her hours were in the answer the whole time. So a partly usable answer is used,
  the hours inside a withheld entry are read back without their project, and the
  screen says what it could not read rather than presenting a short figure as a
  whole one.

  # Spec: dashboard-ui / UI-15
  Scenario: The hours arrive even though GitLab withheld an entry
    Given GitLab withholds an entry of my history
    When I sign in
    Then today reads 6.5 hours
    And I am not told the request was refused
    And the report says one entry was counted without its project
    And the page has no accessibility violations

  # Spec: dashboard-ui / UI-15
  Scenario: The withheld entry is named where its project belongs
    Given GitLab withholds an entry of my history
    When I sign in
    And I open the day GitLab withheld an entry from
    Then the entry says its project was not reported

  # Spec: dashboard-ui / UI-15
  Scenario: An entry nothing could recover is declared, not hidden
    Given GitLab withholds an entry nothing can recover
    When I sign in
    Then today reads 6.5 hours
    And the report says the figures are short by an entry it could not read
