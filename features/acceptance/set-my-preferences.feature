Feature: Setting my preferences
  Hours are counted against a schedule the reader sets, and shown in the
  language and colour scheme they chose. All of it stays on their device.

  # Spec: localization / I18N-3
  Scenario: Switching language changes the whole screen
    Given I am signed in
    When I open the "settings" screen
    And I choose Portuguese
    Then the settings screen is in Portuguese

  # Spec: localization / I18N-3
  Scenario: The chosen language survives a reload
    Given I am signed in
    When I open the "settings" screen
    And I choose Portuguese
    And I reload the settings screen
    Then the settings screen is in Portuguese

  # Spec: user-preferences / PREF-2
  Scenario: A daily target out of range is refused
    Given I am signed in
    When I open the "settings" screen
    And I set Monday to 30 hours
    Then Monday is reported as invalid

  # Spec: user-preferences / PREF-2
  Scenario: A new daily target reaches the dashboard
    Given I am signed in
    When I open the "settings" screen
    And I set Monday to 6 hours
    And I open the "dashboard" screen
    Then the week strip names Monday against a 6 hour target

  # Spec: user-preferences / PREF-4
  Scenario: The colour scheme the reader picks is the one they get
    Given I am signed in
    When I switch the colour scheme
    Then the page is in the dark colour scheme

  # Spec: localization / I18N-1
  # Spec: localization / I18N-2
  Scenario: A browser that prefers Portuguese gets Portuguese
    Given my browser prefers Brazilian Portuguese
    When I sign in
    Then the dashboard is in Portuguese

  # Spec: localization / I18N-4
  Scenario: Dates and numbers follow the language
    Given my browser prefers Brazilian Portuguese
    When I sign in
    Then the date reads as Portuguese writes it
    And the hours read with a comma

  # Spec: localization / I18N-6
  Scenario: The document declares the language it is in
    Given my browser prefers Brazilian Portuguese
    When I sign in
    Then the document declares pt-BR

  # Spec: user-preferences / PREF-3
  Scenario: Changing the time zone regroups the days
    Given I am signed in
    When I open the "settings" screen
    And I choose the Tokyo time zone
    And I open the "dashboard" screen
    Then the week strip is regrouped for Tokyo
