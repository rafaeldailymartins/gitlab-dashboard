import { describe, expect, it } from 'vitest'

import { environmentFor } from './deploy-environment.mjs'

/**
 * The environment a fault report names (OBS-7).
 *
 * The bundle reads the same table at build time through `vite.config.ts`, and a
 * function at run time through its invocation, so a browser fault and a function
 * fault from one deploy land under the same name.
 */
describe('the environment a deploy reports under', () => {
  it.each([
    ['production', 'production'],
    ['branch-deploy', 'staging'],
    ['deploy-preview', 'preview'],
    ['dev', 'development'],
  ])('names a %s deploy %s', (context, environment) => {
    expect(environmentFor(context)).toBe(environment)
  })

  /*
   * Unlike the store, an unknown deploy is not refused: a report that says it
   * does not know where it came from is still a report, and losing it would be
   * losing the one fault that says the platform changed.
   */
  it.each([undefined, '', 'Production', 42, null])(
    'names a deploy that cannot say what it is unknown: %j',
    (context) => {
      expect(environmentFor(context)).toBe('unknown')
    },
  )
})
