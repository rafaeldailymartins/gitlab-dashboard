## RENAMED Requirements

- FROM: `### Requirement: AUTH-3 — The access credential is never written to storage`
- TO: `### Requirement: AUTH-3 — No credential is ever written to storage`

## MODIFIED Requirements

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

## ADDED Requirements

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
