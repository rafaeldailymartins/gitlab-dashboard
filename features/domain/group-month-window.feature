Feature: The month a group report asks for
  The provider filters by an instant range whose reading this app does not
  control, while a day on screen is a day in the reader's own zone. The window
  asked for is therefore wider than the month, and the month is cut from the
  answer locally — so the report is right whichever way the provider reads the
  range.

  # Spec: group-timelog-report / GROUP-2
  Scenario: The window is widened past the month at both ends
    Given a report for the month 2026-05
    Then the window asked for starts at "2026-04-30T00:00:00.000Z"
    And the window asked for ends at "2026-06-01T23:59:59.999Z"
    And the period cut from it runs from 2026-05-01 to 2026-05-31

  # Spec: group-timelog-report / GROUP-2
  Scenario Outline: The widened window covers the month in every time zone
    Given a report for the month 2026-05
    Then the window covers the whole of that month in "<zone>"

    Examples:
      | zone                 |
      | America/Sao_Paulo    |
      | UTC                  |
      | Asia/Tokyo           |
      | Pacific/Kiritimati   |
      | Etc/GMT+12           |

  # Spec: group-timelog-report / GROUP-2
  Scenario: An entry in the month in one zone is outside it in another
    Given a report for the month 2026-05
    And an entry recorded at "2026-04-30T15:00:00Z"
    Then the entry is inside the month in "Asia/Tokyo"
    And the entry is outside the month in "UTC"

  # Spec: group-timelog-report / GROUP-2
  Scenario: The padding days the widened window brought back are dropped
    Given a report for the month 2026-05
    And an entry recorded at "2026-04-30T09:00:00Z"
    Then the entry is outside the month in "UTC"
