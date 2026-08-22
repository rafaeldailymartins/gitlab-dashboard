/**
 * The port every persisted preference and credential goes through.
 *
 * Pure code depends on this interface rather than on `localStorage`, which is
 * what lets the rules that read stored values be tested without a browser.
 */
export interface KeyValueStorage {
  read(key: string): null | string
  remove(key: string): void
  write(key: string, value: string): void
}

/**
 * Wraps a `Storage` so a browser that denies access cannot break the app.
 *
 * Reading `localStorage` throws outright in some privacy modes, and writing
 * throws once a quota is reached. Either way the app carries on with values
 * that last for the session instead of failing.
 *
 * The in-memory fallback is read first, because it only ever holds keys whose
 * write to the underlying store failed — so for those keys it is the authority.
 */
export function guardedStorage(source: Storage): KeyValueStorage {
  const fallback = memoryStorage()

  return {
    read: (key) => fallback.read(key) ?? readFrom(source, key),
    remove: (key) => {
      fallback.remove(key)
      tryRemove(source, key)
    },
    write: (key, value) => {
      if (!tryWrite(source, key, value)) {
        fallback.write(key, value)
      }
    },
  }
}

/** Storage that lives only as long as the page. */
export function memoryStorage(): KeyValueStorage {
  const entries = new Map<string, string>()

  return {
    read: (key) => entries.get(key) ?? null,
    remove: (key) => {
      entries.delete(key)
    },
    write: (key, value) => {
      entries.set(key, value)
    },
  }
}

/** `localStorage` when the browser allows it, memory when it does not. */
export function persistentStorage(): KeyValueStorage {
  try {
    return guardedStorage(globalThis.localStorage)
  } catch {
    return memoryStorage()
  }
}

function readFrom(source: Storage, key: string): null | string {
  try {
    return source.getItem(key)
  } catch {
    return null
  }
}

function tryRemove(source: Storage, key: string): void {
  try {
    source.removeItem(key)
  } catch {
    /* nothing to clean up: the value was never stored */
  }
}

function tryWrite(source: Storage, key: string, value: string): boolean {
  try {
    source.setItem(key, value)
    return true
  } catch {
    return false
  }
}
