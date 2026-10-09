## MODIFIED Requirements

### Requirement: OBS-5 — Reporting costs the first paint nothing

The code that sends reports SHALL NOT be part of what the first page load
requests. It SHALL be fetched once the page is idle. A fault that happens before
it arrives SHALL still be reported once it does.

The initial load SHALL stay within its 196 kB budget.

#### Scenario: The first load

- **WHEN** a reader opens the site for the first time
- **THEN** the files the page requests before it is first drawn include no
  reporting code

#### Scenario: A fault before reporting has loaded

- **WHEN** a fault happens before the reporting code has been fetched
- **THEN** a fault report for it is sent after the reporting code arrives
