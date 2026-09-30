## MODIFIED Requirements

### Requirement: UI-16 — The navigation says which screen the reader is on

The navigation SHALL mark the link to the screen currently open as the current
page, for every screen it links to, and SHALL keep doing so however that
screen's address is completed after it is opened.

#### Scenario: Arriving on a screen from the navigation

- **WHEN** a person opens any screen the navigation links to
- **THEN** that screen's link, and no other, is marked as the current page

#### Scenario: A screen whose address carries choices

- **WHEN** the open screen's address names a team and a month the link did not
- **THEN** its link is still marked as the current page
