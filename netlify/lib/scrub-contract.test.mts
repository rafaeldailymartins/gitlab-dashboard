import type { Event } from '@sentry/core'

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { scrub as functionsScrub } from './scrub.mjs'

/**
 * The browser's scrub and the functions' scrub give one answer.
 *
 * The rule is stated twice because `netlify/` may not import from `src/` at
 * run time, and a second copy of a privacy rule is exactly the copy somebody
 * forgets to change. Both are fed the same generated reports — every field the
 * rule keeps, and a few it does not — and their answers have to be equal.
 */
const textArbitrary = fc.string({ maxLength: 12 })

const urlArbitrary = fc.oneof(
  fc.webUrl({ withFragments: true, withQueryParameters: true }),
  textArbitrary,
  fc.constant('/var/task/netlify/lib/handle-document.mjs?x#y'),
)

const frameArbitrary = fc.record(
  {
    abs_path: urlArbitrary,
    colno: fc.nat(),
    context_line: textArbitrary,
    debug_id: textArbitrary,
    filename: urlArbitrary,
    function: textArbitrary,
    in_app: fc.boolean(),
    lineno: fc.nat(),
    vars: fc.dictionary(textArbitrary, textArbitrary),
  },
  { requiredKeys: [] },
)

const exceptionArbitrary = fc.record(
  {
    mechanism: fc.record({
      data: fc.dictionary(textArbitrary, textArbitrary),
      handled: fc.boolean(),
      parent_id: fc.nat(),
      type: textArbitrary,
    }),
    stacktrace: fc.record({ frames: fc.array(frameArbitrary, { maxLength: 3 }) }),
    type: fc.constantFrom('TypeError', 'SyntaxError', 'GraphQLRequestError', 'Error'),
    // Messages either side of the limit, which short generated strings never reach.
    value: fc.oneof(textArbitrary, fc.string({ maxLength: 220, minLength: 190 })),
  },
  { requiredKeys: [] },
)

const eventArbitrary: fc.Arbitrary<Event> = fc.record(
  {
    contexts: fc.record({
      browser: fc.record({ name: textArbitrary, version: textArbitrary, viewport: textArbitrary }),
      culture: fc.record({ timezone: textArbitrary }),
    }),
    debug_meta: fc.record({
      images: fc.array(
        fc.record({
          code_file: urlArbitrary,
          debug_id: textArbitrary,
          type: fc.constant('sourcemap' as const),
        }),
        { maxLength: 2 },
      ),
    }),
    environment: textArbitrary,
    exception: fc.record({ values: fc.array(exceptionArbitrary, { maxLength: 2 }) }),
    extra: fc.dictionary(textArbitrary, textArbitrary),
    message: textArbitrary,
    release: textArbitrary,
    request: fc.record(
      { headers: fc.dictionary(textArbitrary, textArbitrary), url: urlArbitrary },
      { requiredKeys: [] },
    ),
    sdk: fc.record({
      integrations: fc.array(textArbitrary),
      name: textArbitrary,
      version: textArbitrary,
    }),
    tags: fc.dictionary(
      fc.constantFrom('document', 'kind', 'origin', 'reason', 'team'),
      textArbitrary,
    ),
    timestamp: fc.nat(),
    user: fc.record({ username: textArbitrary }),
  },
  { requiredKeys: [] },
)

describe("the functions' scrub", () => {
  it('answers exactly as the browser’s does, for any report', async () => {
    const { scrub: browserScrub } = await import('@/shared/lib/scrub')

    fc.assert(
      fc.property(eventArbitrary, (event) => {
        expect(functionsScrub(event)).toEqual(browserScrub(event))
      }),
    )
  })
})
