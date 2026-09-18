import { getStore } from '@netlify/blobs'

import type { TeamStore } from './team-store.mjs'

/**
 * The store name. One blob per reader lives under it, keyed by their subject.
 */
const STORE = 'teams'

/**
 * Where the data is held, stated rather than defaulted.
 *
 * A site-wide store does not take this from the environment the way a
 * deploy-scoped one does, so omitting it lets the API pick — and a store's data
 * does not move if this value changes later. That makes it a decision to take
 * once, now, rather than a default to discover.
 */
const REGION = 'us-east-1'

/**
 * Teams at rest.
 *
 * Site-wide rather than deploy-scoped: a deploy store's contents die with the
 * deploy that wrote them, and a team that vanishes on the next release is worse
 * than one that was never saved.
 *
 * Strongly consistent rather than eventually. The one claim this feature makes
 * is that a team saved on the laptop is there on the phone, and the default
 * would also make the version check below unreliable — a caller could hold a
 * version that is already stale through no fault of its own.
 */
export function blobTeamStore(): TeamStore {
  const store = getStore({ consistency: 'strong', name: STORE, region: REGION })

  return {
    async read(key) {
      const found = await store.getWithMetadata(key, { type: 'text' })

      if (found === null) {
        return null
      }

      if (found.etag === undefined) {
        // Every write here is conditional on a version, so a stored document
        // with none is one nothing could safely replace. Failing loudly beats
        // handing back a document the reader would then be unable to save.
        throw new Error('the store returned a document with no version')
      }

      return { etag: found.etag, text: found.data }
    },

    async write(key, text, expected) {
      const result =
        expected === null
          ? await store.set(key, text, { onlyIfNew: true })
          : await store.set(key, text, { onlyIfMatch: expected })

      if (!result.modified) {
        return { ok: false, reason: 'conflict' }
      }

      if (result.etag === undefined) {
        throw new Error('the store accepted a write and named no version')
      }

      return { etag: result.etag, ok: true }
    },
  }
}
