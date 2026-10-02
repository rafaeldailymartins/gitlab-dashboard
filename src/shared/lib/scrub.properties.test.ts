import type { Event } from '@sentry/core'

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { scrub } from './scrub'

/**
 * `scrub` over generated reports carrying somebody's data in every field.
 *
 * Each planted value is built around a marker no field `scrub` keeps could hold
 * by accident, in the shapes this app actually has on screen: a username, an
 * email, a team's name, a group's path, a GitLab token, and a query string
 * carrying either of the last two. The property is that none of them is left
 * anywhere in what would be sent — OBS-3, stated for every report rather than
 * for the few written out in `scrub.test.ts`.
 *
 * The one field that keeps text it was given is an exception's message, and
 * only for classes this app or the engine wrote. The marker goes into the
 * message of a class nobody here wrote, which is the case that matters.
 */
const markerArbitrary = fc
  .string({
    maxLength: 8,
    minLength: 4,
    unit: fc.integer({ max: 15, min: 0 }).map((n) => String.fromCodePoint(97 + n)),
  })
  .map((tail) => `zq${tail}zq`)

const personalArbitrary = markerArbitrary.chain((marker) =>
  fc.constantFrom(
    marker,
    `${marker}@example.com`,
    `Squad ${marker}`,
    `acme/${marker}/backend`,
    `glpat-${marker}`,
    `?team=${marker}&group=acme%2F${marker}`,
  ),
)

const ASSET = 'https://gitlabdashboard.netlify.app/assets/index-CaqkUbAi.js'

function planted(personal: string, className: string): Event {
  return {
    breadcrumbs: [{ data: { url: personal }, message: personal }],
    contexts: {
      browser: { name: 'Firefox', user_agent: personal, version: '131' },
      culture: { timezone: personal },
      [personal]: { value: personal },
    },
    debug_meta: {
      images: [{ code_file: `${ASSET}?${personal}`, debug_id: 'd', type: 'sourcemap' }],
    },
    exception: {
      values: [
        {
          mechanism: { data: { target: personal }, handled: false, type: 'onerror' },
          module: personal,
          stacktrace: {
            frames: [
              {
                abs_path: `${ASSET}?${personal}`,
                context_line: personal,
                filename: `${ASSET}#${personal}`,
                function: 'render',
                module_metadata: { owner: personal },
                post_context: [personal],
                pre_context: [personal],
                vars: { [personal]: personal },
              },
            ],
          },
          type: className,
          value: `could not read ${personal}`,
        },
      ],
    },
    extra: { [personal]: personal },
    fingerprint: [personal],
    logentry: { message: personal, params: [personal] },
    message: personal,
    modules: { [personal]: personal },
    request: {
      cookies: { session: personal },
      data: { variables: { username: personal } },
      env: { HOME: personal },
      headers: { authorization: `Bearer ${personal}` },
      method: personal,
      query_string: personal,
      url: `https://gitlabdashboard.netlify.app/team?team=${encodeURIComponent(personal)}#${personal}`,
    },
    sdk: { integrations: [personal], name: 'sentry.javascript.browser', version: '11.2.0' },
    server_name: personal,
    tags: { group: personal, origin: 'query', [personal]: 'x' },
    transaction: personal,
    user: { email: personal, id: personal, ip_address: personal, username: personal },
  }
}

/** Classes whose messages could be anything, because nobody here wrote them. */
const unknownClassArbitrary = fc.constantFrom(
  'Error',
  'SyntaxError',
  'ZodError',
  'UnhandledRejection',
)

describe('scrub, for any report carrying somebody’s data', () => {
  it('sends none of it, in any field', () => {
    fc.assert(
      fc.property(personalArbitrary, unknownClassArbitrary, (personal, className) => {
        const marker = /zq[a-p]+zq/u.exec(personal)?.[0] ?? personal
        const sent = JSON.stringify(scrub(planted(personal, className)))

        expect(sent).not.toContain(marker)
      }),
    )
  })

  it('still says which class of error it was', () => {
    fc.assert(
      fc.property(personalArbitrary, unknownClassArbitrary, (personal, className) => {
        const exception = scrub(planted(personal, className)).exception?.values?.[0]

        expect(exception?.type).toBe(className)
        expect(exception?.value).toBe(className)
      }),
    )
  })
})
