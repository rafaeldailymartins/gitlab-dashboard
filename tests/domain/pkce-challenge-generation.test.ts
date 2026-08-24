import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'

import {
  challengeFor,
  createVerifier,
  type RandomBytes,
  type Sha256,
} from '@/entities/sessions/model/pkce'

const feature = await loadFeature('features/domain/pkce-challenge-generation.feature')

/** RFC 7636 section 4.1: the unreserved set. */
const UNRESERVED = /^[A-Za-z0-9\-._~]+$/

const randomBytes: RandomBytes = (size) => globalThis.crypto.getRandomValues(new Uint8Array(size))

const sha256: Sha256 = async (input) =>
  new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', input))

/** Hoisted so the step callback does not nest a fourth level of closure. */
function manyVerifiers(count: number): string[] {
  return Array.from({ length: count }, () => createVerifier(randomBytes))
}

describeFeature(feature, ({ Scenario }) => {
  Scenario("The challenge matches the specification's own test vector", ({ Given, Then, When }) => {
    let verifier = ''
    let challenge = ''

    Given('the verifier {string} from RFC 7636', (_context, value: string) => {
      verifier = value
    })

    When('the S256 challenge is derived', async () => {
      challenge = await challengeFor(verifier, sha256)
    })

    Then('it is {string}', (_context, expected: string) => {
      expect(challenge).toBe(expected)
    })
  })

  Scenario(
    'A verifier is long enough to be unguessable and short enough to send',
    ({ And, Then, When }) => {
      let verifier = ''

      When('a verifier is generated', () => {
        verifier = createVerifier(randomBytes)
      })

      Then('it is between 43 and 128 characters long', () => {
        expect(verifier.length).toBeGreaterThanOrEqual(43)
        expect(verifier.length).toBeLessThanOrEqual(128)
      })

      And('every character is one the specification allows', () => {
        expect(verifier).toMatch(UNRESERVED)
      })
    },
  )

  Scenario('Each authorization request gets its own verifier', ({ Then, When }) => {
    let verifiers: string[] = []

    When('fifty verifiers are generated', () => {
      verifiers = manyVerifiers(50)
    })

    Then('no two of them are the same', () => {
      expect(new Set(verifiers).size).toBe(verifiers.length)
    })
  })

  Scenario('The challenge does not give the verifier away', ({ Given, Then, When }) => {
    let verifier = ''
    let challenge = ''

    Given('the verifier {string} from RFC 7636', (_context, value: string) => {
      verifier = value
    })

    When('the S256 challenge is derived', async () => {
      challenge = await challengeFor(verifier, sha256)
    })

    Then('it does not contain the verifier', () => {
      expect(challenge).not.toContain(verifier)
    })
  })
})
