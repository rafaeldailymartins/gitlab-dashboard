import { getStore } from '@netlify/blobs'

import type { DocumentStore } from './document-store.mjs'

/**
 * The store name. One blob per reader lives under it, keyed by their subject.
 */
const STORE = 'teams'

/**
 * Where the data is held, stated rather than defaulted — and stated as the
 * value every tool already assumes.
 *
 * A site-wide store does not take this from the environment the way a
 * deploy-scoped one does, so omitting it lets the API pick, and a store's data
 * does not move if the pick changes later. That is why it is pinned rather than
 * left out.
 *
 * It was `us-east-1`, which was a defensible pin and an expensive one. Netlify's
 * own tools all default to `us-east-2`: the Blobs browser in the dashboard shows
 * nothing at all for a store held elsewhere — verified by writing a probe blob
 * to `us-east-2` and watching it appear while the real store stayed invisible —
 * and `netlify blobs:list` answers with an empty list rather than an error
 * unless `--region` is passed. So the data was fine and unreachable by every
 * instrument except this code, which is the worst way for storage to be
 * correct.
 *
 * Pinned to the default rather than omitted, so the two arguments both hold:
 * the location cannot drift if Netlify changes its mind, and every tool finds
 * it with no flag.
 *
 * **Changing this again does not move anything.** The two documents that
 * existed were copied across by hand before it changed; a future change needs
 * the same, or it orphans data silently — a missing key is indistinguishable
 * from a reader who has never saved.
 */
const REGION = 'us-east-2'

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
export function blobDocumentStore(): DocumentStore {
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
