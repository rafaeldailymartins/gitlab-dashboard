# gitlab-authentication Specification

## Purpose

Lets a person read their own GitLab time tracking using their own GitLab
identity, without the application ever holding a long-lived credential or asking
them to paste a token.

## Requirements

### Requirement: AUTH-1 — Sign in with a GitLab account

The system SHALL let a person authenticate with their own GitLab account and
SHALL NOT accept, store or ask for a Personal Access Token.

#### Scenario: Starting sign-in

- **WHEN** a signed-out person chooses to sign in
- **THEN** they are sent to GitLab's authorization page for this application

#### Scenario: Returning from a granted authorization

- **WHEN** GitLab returns the person to the application after they grant access
- **THEN** the session becomes active and the dashboard is shown

#### Scenario: No token entry exists

- **WHEN** a person inspects the sign-in screen
- **THEN** there is no field for a Personal Access Token anywhere in the
  application

### Requirement: AUTH-2 — The authorization exchange resists interception

Each authorization request SHALL carry a single-use verifier and a single-use
anti-forgery value, and the system SHALL refuse a callback whose anti-forgery
value does not match the pending request.

#### Scenario: A callback with a mismatched state

- **WHEN** the application receives a callback whose anti-forgery value differs
  from the one it issued
- **THEN** no session is established
- **AND** the person is told the sign-in could not be completed and is offered
  another attempt

#### Scenario: A callback with no pending request

- **WHEN** the application receives a callback and has no pending authorization
  request
- **THEN** no session is established and the person is returned to sign-in

#### Scenario: A verifier is used once

- **WHEN** an authorization callback has been exchanged successfully
- **THEN** its verifier is discarded and cannot be replayed

### Requirement: AUTH-3 — No credential is ever written to storage

The access credential SHALL exist only for the lifetime of the page and SHALL
NOT be written to any persistent browser storage.

The identity assertion SHALL be held the same way and for the same reason. It
names the reader to this app's own store, and although it grants no authority
over anything in GitLab, a credential in storage is one an injected script can
read at leisure rather than only while a tab is open.

#### Scenario: Inspecting storage while signed in

- **WHEN** a signed-in person inspects local storage, session storage and
  cookies
- **THEN** neither the access credential nor the identity assertion appears in
  any of them

### Requirement: AUTH-4 — The session survives leaving and returning

A person who has signed in SHALL remain signed in on a later visit without
re-authorizing, until they sign out or the renewal credential stops being
accepted.

#### Scenario: Returning after closing the tab

- **WHEN** a signed-in person closes the tab and opens the application again
- **THEN** they are still signed in and are not sent to GitLab

#### Scenario: The renewal credential is rejected

- **WHEN** GitLab refuses the stored renewal credential
- **THEN** the session ends, the stored credential is discarded, and the person
  is asked to sign in again

### Requirement: AUTH-5 — Expiry is handled without the person noticing

The system SHALL renew the access credential before or upon expiry and SHALL
retry the interrupted request, performing at most one renewal for any number of
requests that fail concurrently.

#### Scenario: A request meets an expired credential

- **WHEN** a data request is rejected as unauthorized because the credential
  expired
- **THEN** the credential is renewed and the request succeeds
- **AND** no error is shown to the person

#### Scenario: Several requests expire together

- **WHEN** more than one request is rejected as unauthorized at the same time
- **THEN** exactly one renewal is performed and every request is retried with
  its result

### Requirement: AUTH-6 — Signing out leaves nothing behind

Signing out SHALL discard the session, ask GitLab to invalidate the credentials,
and clear every cached report from the device.

#### Scenario: Signing out

- **WHEN** a signed-in person signs out
- **THEN** the sign-in screen is shown
- **AND** no stored credential and no cached report data remain on the device

#### Scenario: Revocation is unavailable

- **WHEN** the request to invalidate the credentials cannot be delivered
- **THEN** the local session and cached data are still cleared and the person is
  still signed out

### Requirement: AUTH-7 — The application has read-only authority

The authorization SHALL request read-only access to GitLab's data, and the
application SHALL NOT perform any operation that changes data in GitLab.

The authorization MAY additionally request the reader's identity, which confers
no authority over any data and is what lets this app's own store learn who is
calling without being handed a credential that reads GitLab. Nothing beyond those
two SHALL be requested, and the request SHALL be asserted against the exact set
rather than against the absence of any particular scope — a rule stated as "and
nothing else" passes for a scope nobody thought to name.

#### Scenario: Reviewing the granted authority

- **WHEN** a person reviews this application in their GitLab account settings
- **THEN** the granted authority over data is read-only

#### Scenario: What the authorization asks for

- **WHEN** the application sends a person to GitLab to authorize it
- **THEN** the request names read-only data access and the reader's identity, and
  names nothing else

### Requirement: AUTH-8 — Protected screens require a session and remember intent

A person without an active session SHALL be sent to sign-in, and after signing
in SHALL arrive at the screen they originally asked for. A person who already has
a session SHALL NOT be shown the sign-in screen, and SHALL NOT be shown
signed-in navigation while signed out.

#### Scenario: Opening a deep link while signed out

- **WHEN** a signed-out person opens a link to a specific day
- **THEN** they are asked to sign in
- **AND** after signing in they land on that day, not on the default screen

#### Scenario: Opening sign-in with a session already active

- **WHEN** a person who is signed in opens the sign-in screen
- **THEN** they are sent on to the screen they asked for instead of being asked
  to sign in again

#### Scenario: The sign-in screen carries no signed-in navigation

- **WHEN** a signed-out person is asked to sign in
- **THEN** there is no navigation and no way to sign out on the screen

### Requirement: AUTH-9 — A refused or failed sign-in is explained

When authorization is denied or fails, the system SHALL tell the person what
happened in their own language and offer to try again.

#### Scenario: The person declines at GitLab

- **WHEN** a person declines to authorize the application
- **THEN** they return to the sign-in screen with an explanation and a way to
  retry

### Requirement: AUTH-10 — An identity assertion is obtained when it is needed, not kept

The application SHALL be able to obtain, on demand, an assertion of who the
reader is that a party other than this browser can verify for itself against the
provider.

The assertion is short-lived by the provider's choice, so it SHALL be obtained
when it is about to be used rather than held and reused. Obtaining one SHALL go
through the same single renewal a burst of requests already shares, so asking for
several at once costs the provider one exchange and consumes one rotating
credential.

#### Scenario: Two things need an identity at once

- **WHEN** two requests needing an identity assertion are made together
- **THEN** the provider is asked once

#### Scenario: An assertion that has expired

- **WHEN** an identity assertion is needed and the one held is no longer accepted
- **THEN** a new one is obtained before the request is made

### Requirement: AUTH-11 — A session predating the identity scope is repaired, not discarded

A reader whose session was granted before the application asked for their
identity SHALL keep that session. Everything it authorises SHALL continue to
work.

Where such a reader reaches something that needs an identity, the screen SHALL
say what is needed and offer to authorize again, returning them where they were.
It SHALL NOT sign them out: discarding a working session because a secondary
screen wants something else loses the reader's place for no gain.

#### Scenario: An older session still reads hours

- **WHEN** a reader whose session predates the identity scope opens their
  dashboard
- **THEN** their hours are shown as usual

#### Scenario: An older session reaches something that needs an identity

- **WHEN** such a reader opens a screen that needs an identity assertion
- **THEN** that screen offers to authorize again and says why
- **AND** the reader is not signed out
