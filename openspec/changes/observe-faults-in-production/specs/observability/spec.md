## Purpose

How the author learns that this app has failed for somebody: which faults the
browser and the document endpoints report, what a report may carry, the route it
takes to the error tracker, and what reporting may cost the reader.

## ADDED Requirements

### Requirement: OBS-1 — A fault in the browser is reported

The browser SHALL report an error nothing in the app caught, a promise rejection
nothing handled, and an error the router caught while loading or rendering a
route. Each SHALL be reported once.

A request to GitLab that failed SHALL be reported once the app has stopped
retrying it, when GitLab could not be reached or refused the request. A request
that failed because GitLab no longer accepts the reader's credential SHALL NOT
be reported: that is the session ending, and the app already handles it by
asking the reader to sign in again.

What the reader sees SHALL NOT change because a fault was reported. A screen
that drew an error before this requirement SHALL draw the same error.

#### Scenario: GitLab cannot be reached

- **WHEN** a signed-in reader opens the dashboard
- **AND** every request to GitLab fails because GitLab cannot be reached
- **THEN** a fault report is sent
- **AND** the dashboard says it could not reach GitLab, as it did before

#### Scenario: The reader's credential has expired

- **WHEN** a signed-in reader opens the dashboard
- **AND** GitLab answers that the reader's credential is no longer accepted
- **THEN** no fault report is sent

#### Scenario: An error nothing caught

- **WHEN** an error is thrown that nothing in the app catches
- **THEN** a fault report is sent naming that error

### Requirement: OBS-2 — A fault in a document endpoint is reported

A document endpoint SHALL report an exception raised while it served a request,
and every answer of `503` it gives, with the reason that answer carries:
identity could not be established, or no store could be used. The report SHALL
name the document the endpoint serves.

An answer the endpoint gave because of the request itself SHALL NOT be reported:
a missing or rejected credential, a version that no longer matches, a body that
is too large, malformed or of the wrong type, or a write that names no version.
Those are the endpoint doing its job.

Reporting SHALL NOT change the answer. A request that was refused SHALL be
refused with the status and body it was refused with before this requirement,
whether or not the report could be sent.

#### Scenario: The store cannot be reached

- **WHEN** a reader saves a team
- **AND** the store does not answer
- **THEN** the endpoint answers `503` with `store-unavailable`
- **AND** a fault report is sent with the reason `store-unavailable` and the
  document `teams`

#### Scenario: A stale write

- **WHEN** a reader saves a team against a version that is no longer current
- **THEN** the endpoint answers `409`
- **AND** no fault report is sent

#### Scenario: An unsigned request

- **WHEN** a request reaches a document endpoint with no credential
- **THEN** the endpoint answers `401`
- **AND** no fault report is sent

### Requirement: OBS-3 — A report carries nothing about the reader or their colleagues

A fault report SHALL carry only what locates the fault: the error's type, its
message when the app wrote it, its stack, the address path of the screen, the
release, the deploy, and the browser and operating system.

A fault report SHALL NOT carry the reader's identity in any form (subject,
username, name, email, avatar, IP address), any credential or token, the name
of a team, the name or path of a group, any person's name or hours, an address's
query string or fragment, a request or response body, a request header, a
cookie, a GraphQL document or its variables, or message text that came from
GitLab. A value that was going to be sent and that matches one of those SHALL be
removed before the report leaves the browser or the endpoint, not after it
reaches the error tracker.

The address SHALL be sent as its path alone. The team and the group a report
is narrowed to travel in the query string, which is never sent, and a path
naming a day is sent as it is, because a date is not personal.

#### Scenario: A fault on a team's report

- **WHEN** a reader is reading a team narrowed to a group
- **AND** a fault report is sent
- **THEN** the report contains neither the team's name nor the group's path
- **AND** it contains none of the names on the team

#### Scenario: A fault while signed in

- **WHEN** a signed-in reader's dashboard sends a fault report
- **THEN** the report contains neither the reader's name nor their access token

#### Scenario: GitLab refused a request

- **WHEN** GitLab refuses a request with a message of its own
- **AND** a fault report is sent for it
- **THEN** the report does not contain GitLab's message

### Requirement: OBS-4 — Reports leave through this origin

The browser SHALL send fault reports to this site's own origin and to nowhere
else, so the Content-Security-Policy SHALL keep reaching this origin and GitLab
and no other.

The endpoint that receives reports SHALL forward to the configured error-tracker
project only. It SHALL refuse a report addressed to any other project, a report
carrying anything but error events, and a report larger than its bound, and it
SHALL forward no client address, cookie or credential.

#### Scenario: The policy is unchanged

- **WHEN** the site is built with fault reporting configured
- **THEN** the policy's `connect-src` names this origin and GitLab and nothing
  else

#### Scenario: A report for another project

- **WHEN** a report addressed to a project other than the configured one
  reaches the reporting endpoint
- **THEN** the endpoint refuses it
- **AND** nothing is forwarded

### Requirement: OBS-5 — Reporting costs the first paint nothing

The code that sends reports SHALL NOT be part of what the first page load
requests. It SHALL be fetched once the page is idle. A fault that happens before
it arrives SHALL still be reported once it does.

The initial load SHALL stay within its 180 kB budget.

#### Scenario: The first load

- **WHEN** a reader opens the site for the first time
- **THEN** the files the page requests before it is first drawn include no
  reporting code

#### Scenario: A fault before reporting has loaded

- **WHEN** a fault happens before the reporting code has been fetched
- **THEN** a fault report for it is sent after the reporting code arrives

### Requirement: OBS-6 — Reporting never breaks the app

A report that could not be sent, reporting code that could not be fetched, and
an error tracker that refuses or is over its quota SHALL change nothing the
reader sees and SHALL NOT be reported in turn.

#### Scenario: The reporting endpoint is down

- **WHEN** the reporting endpoint refuses every report
- **AND** a fault happens
- **THEN** the screen behaves exactly as it would with reporting working

### Requirement: OBS-7 — A report names its release and its deploy

Every report SHALL name the commit the deploy was built from and the deploy it
came from: production, homologation or a deploy preview. The functions and the
browser on one deploy SHALL name the same release.

A build with no error-tracker project configured SHALL fetch no reporting code
and send no report, so a local run, the test suites and a fork's build report
nothing.

#### Scenario: A report names where it came from

- **WHEN** the site is built from a commit for homologation
- **AND** a fault report is sent
- **THEN** the report names that commit as its release
- **AND** it names homologation as its deploy

#### Scenario: A build with nothing configured

- **WHEN** the site is built with no error-tracker project configured
- **AND** a fault happens
- **THEN** no report is sent
- **AND** no reporting code is fetched

### Requirement: OBS-8 — A stack trace reads as the source

A report from a production bundle SHALL be readable as the source it was built
from: files, lines and function names as they are written, not as they were
minified. The maps that make that possible SHALL reach the error tracker when
one is configured, and SHALL NOT be served by the site whether one is or not.

#### Scenario: The maps are not published

- **WHEN** the site is built
- **THEN** the built site serves no source map
- **AND** no built script names a source map
