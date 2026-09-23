/**
 * Where a reader's documents rest, as the handler needs it and no more.
 *
 * A port rather than the store itself, for two reasons. The handler's rules —
 * who may read what, what a write must carry, what a conflict answers — are the
 * part worth testing, and they are untestable against a store that throws
 * outside its own platform. And the acceptance suite serves a static build with
 * no function in it, so these tests are the only place those rules are proved.
 */
export interface DocumentStore {
  read(key: string): Promise<null | StoredRecord>
  /**
   * Writes only if the stored version is `expected`.
   *
   * `null` means "only if nothing is stored yet". A caller that passed neither
   * would be replacing a document it has not seen, which is the silent clobber
   * this signature exists to make unexpressible.
   */
  write(key: string, text: string, expected: null | string): Promise<WriteResult>
}

export interface StoredRecord {
  /** Opaque. Whatever the store gave us, handed back unread. */
  readonly etag: string
  readonly text: string
}

type WriteResult =
  { readonly etag: string; readonly ok: true } | { readonly ok: false; readonly reason: 'conflict' }

/** A store for the tests and for local development. Holds nothing on exit. */
export function memoryDocumentStore(): DocumentStore {
  const records = new Map<string, StoredRecord>()
  let version = 0

  return {
    read(key) {
      return Promise.resolve(records.get(key) ?? null)
    },

    write(key, text, expected) {
      const current = records.get(key) ?? null

      if ((current?.etag ?? null) !== expected) {
        return Promise.resolve({ ok: false, reason: 'conflict' })
      }

      version += 1
      const etag = `"${String(version)}"`
      records.set(key, { etag, text })

      return Promise.resolve({ etag, ok: true })
    },
  }
}
