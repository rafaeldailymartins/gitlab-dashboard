Feature: Reporting a fault
  When this app fails for somebody, its author hears about it without having
  to be told — and nothing about the reader, or about the people on the
  reader's screen, goes with the report. The report travels through this site
  and nowhere else, and costs the first load nothing.

  # Spec: observability / OBS-1
  # Spec: observability / OBS-3
  Scenario: GitLab cannot be reached
    Given fault reports are being recorded
    And GitLab cannot be reached
    When I sign in
    Then I am told GitLab could not be reached
    And a fault report is sent
    And no fault report contains my name or my access token

  # Spec: observability / OBS-3
  Scenario: A fault on a team's report
    Given fault reports are being recorded
    And I am signed in
    When I open the report for my team in "2026-05", narrowed to "invent-software/squad-fiscal"
    And something on the page fails that nothing catches
    Then a fault report is sent
    And no fault report contains the team's name, the group's path or anybody on the team

  # Spec: observability / OBS-4
  Scenario: The policy is unchanged
    Then the policy lets the page reach this site and GitLab, and nothing else

  # Spec: observability / OBS-5
  Scenario: Reporting costs the first load nothing
    Given fault reports are being recorded
    And I am signed in
    Then the page the site serves asks for no reporting code
    And the reporting code is fetched afterwards

  # Spec: observability / OBS-6
  Scenario: The reporting endpoint is down
    Given the reporting endpoint refuses every report
    And GitLab cannot be reached
    When I sign in
    Then I am told GitLab could not be reached
    And I am offered a retry

  # Spec: observability / OBS-7
  Scenario: A report names where it came from
    Given fault reports are being recorded
    And I am signed in
    When something on the page fails that nothing catches
    Then a fault report is sent
    And it names the commit and the deploy the site was built for
