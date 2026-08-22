Feature: PKCE challenge generation
  The authorization request carries a challenge; only the token exchange carries
  the verifier it was derived from. That is what stops an intercepted
  authorization code from being redeemed by whoever intercepted it, and it is
  why the derivation has to be exactly what RFC 7636 specifies.

  # Spec: gitlab-authentication / AUTH-2
  Scenario: The challenge matches the specification's own test vector
    Given the verifier "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" from RFC 7636
    When the S256 challenge is derived
    Then it is "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

  # Spec: gitlab-authentication / AUTH-2
  Scenario: A verifier is long enough to be unguessable and short enough to send
    When a verifier is generated
    Then it is between 43 and 128 characters long
    And every character is one the specification allows

  # Spec: gitlab-authentication / AUTH-2
  Scenario: Each authorization request gets its own verifier
    When fifty verifiers are generated
    Then no two of them are the same

  # Spec: gitlab-authentication / AUTH-2
  Scenario: The challenge does not give the verifier away
    Given the verifier "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" from RFC 7636
    When the S256 challenge is derived
    Then it does not contain the verifier
