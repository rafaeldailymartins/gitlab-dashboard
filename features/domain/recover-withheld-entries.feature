Feature: Recovering entries GitLab withheld
  GitLab withholds a whole timelog when it cannot resolve the project the time
  was logged in, and reports the reason beside the entries it could resolve. Those
  hours are the reader's own. Discarding the answer emptied a reader's dashboard
  over three entries out of twenty-five; discarding only the withheld entries
  would have understated her hours instead, which is quieter and no better.

  # Spec: personal-timelog-report / REPORT-10
  Scenario: Entries and errors arrive together
    Given GitLab withholds three entries of a page and reports why
    When the timelogs are read
    Then the entries GitLab could resolve are reported
    And the answer is not treated as a failure

  # Spec: personal-timelog-report / REPORT-10
  Scenario: An answer carrying errors and nothing else
    Given GitLab answers with errors and no entries at all
    When the timelogs are read
    Then the request is reported as refused by GitLab

  # Spec: personal-timelog-report / REPORT-10
  Scenario: A short answer is not mistaken for a whole one
    Given GitLab withholds three entries of a page and reports why
    When the timelogs are read
    Then the page says three entries were withheld

  # Spec: personal-timelog-report / REPORT-11
  Scenario: The withheld hours are recovered and counted
    Given GitLab withholds three entries of a page and reports why
    When the timelogs are read
    Then every entry of the page is counted
    And the hours counted equal the hours logged
    And three entries carry no project

  # Spec: personal-timelog-report / REPORT-11
  Scenario: An entry already read is not counted twice
    Given GitLab withholds three entries of a page and reports why
    And asking again without the project returns the whole page
    When the timelogs are read
    Then every entry of the page is counted
    And the hours counted equal the hours logged

  # Spec: personal-timelog-report / REPORT-11
  Scenario: A page GitLab answered whole is not asked for a second time
    Given GitLab answers a page with nothing withheld
    When the timelogs are read
    Then GitLab is asked once

  # Spec: personal-timelog-report / REPORT-11
  Scenario: An entry nothing can recover
    Given GitLab withholds three entries of a page and reports why
    And asking again without the project withholds them too
    When the timelogs are read
    Then the page says three entries were withheld and none recovered

  # Spec: personal-timelog-report / REPORT-11
  Scenario: A day counts an entry whose project could not be read
    Given a day with an entry of 3600 seconds and no readable project
    When the day is aggregated
    Then the day total is 1 hours
    And the day shows the entry with no project

  # Spec: personal-timelog-report / REPORT-11
  Scenario: Unreadable projects are one group in the split by project
    Given two entries in different unreadable projects
    When the period is split by project
    Then there is one group with no project
