import { describe, expect, it } from 'vitest'

import { storeNameFor } from './store-name.mjs'

/**
 * Which store each deploy files a reader's documents under (DELIVERY-1).
 *
 * The whole of the rule is this table, and each row is a way to get it wrong in
 * silence: production reading anywhere else shows every reader an empty list of
 * teams they did make, and anything else reading production's lets homologation
 * write over them.
 */
describe('the store a deploy files documents under', () => {
  it("keeps production in production's store", () => {
    expect(storeNameFor('production')).toBe('readers')
  })

  it.each(['branch-deploy', 'deploy-preview'])('keeps a %s out of it', (context) => {
    expect(storeNameFor(context)).toBe('readers-staging')
  })

  /*
   * `netlify dev` is the one way a developer's machine could reach a real store,
   * and a laptop is exactly where production's documents must not be written.
   */
  it('keeps a local run out of it too', () => {
    expect(storeNameFor('dev')).toBe('readers-staging')
  })

  /*
   * Guessing either way is worse than refusing. The platform names the context;
   * a value it did not name is a platform this code no longer understands.
   */
  it.each([undefined, '', 'Production', 'production ', 'staging', 42, null])(
    'names no store for a deploy that cannot say what it is: %j',
    (context) => {
      expect(storeNameFor(context)).toBeNull()
    },
  )
})
