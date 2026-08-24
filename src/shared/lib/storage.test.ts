import { afterEach, describe, expect, it, vi } from 'vitest'

import { guardedStorage, memoryStorage, persistentStorage } from './storage'

/** A `Storage` whose every operation fails, as in a locked-down privacy mode. */
function fail(): never {
  throw new DOMException('Access is denied for this document', 'SecurityError')
}

/** A `Storage` whose every operation fails, as in a locked-down privacy mode. */
function hostileStorage(): Storage {
  return {
    clear: fail,
    getItem: fail,
    key: fail,
    get length(): number {
      return fail()
    },
    removeItem: fail,
    setItem: fail,
  }
}

/** A `Storage` that reads fine but refuses to write, as when a quota is full. */
function readOnlyStorage(): Storage {
  const entries = new Map<string, string>()

  return {
    clear: () => {
      entries.clear()
    },
    getItem: (key) => entries.get(key) ?? null,
    key: () => null,
    get length(): number {
      return entries.size
    },
    removeItem: (key) => {
      entries.delete(key)
    },
    setItem: () => {
      throw new DOMException('The quota has been exceeded', 'QuotaExceededError')
    },
  }
}

describe('memoryStorage', () => {
  it('reads back what it wrote', () => {
    const storage = memoryStorage()

    storage.write('theme', 'dark')

    expect(storage.read('theme')).toBe('dark')
  })

  it('returns null for a key it does not hold', () => {
    expect(memoryStorage().read('absent')).toBeNull()
  })

  it('overwrites an existing value', () => {
    const storage = memoryStorage()

    storage.write('theme', 'dark')
    storage.write('theme', 'light')

    expect(storage.read('theme')).toBe('light')
  })

  it('removes a value', () => {
    const storage = memoryStorage()

    storage.write('theme', 'dark')
    storage.remove('theme')

    expect(storage.read('theme')).toBeNull()
  })

  it('tolerates removing a key it does not hold', () => {
    expect(() => {
      memoryStorage().remove('absent')
    }).not.toThrow()
  })

  it('keeps two instances independent', () => {
    const first = memoryStorage()
    const second = memoryStorage()

    first.write('theme', 'dark')

    expect(second.read('theme')).toBeNull()
  })
})

describe('guardedStorage', () => {
  it('delegates to the underlying store when it works', () => {
    const storage = guardedStorage(globalThis.localStorage)

    storage.write('theme', 'dark')

    expect(globalThis.localStorage.getItem('theme')).toBe('dark')
    expect(storage.read('theme')).toBe('dark')

    storage.remove('theme')

    expect(globalThis.localStorage.getItem('theme')).toBeNull()
    expect(storage.read('theme')).toBeNull()
  })

  it('keeps working when every operation is denied', () => {
    const storage = guardedStorage(hostileStorage())

    storage.write('theme', 'dark')

    expect(storage.read('theme')).toBe('dark')
  })

  it('reads back a value whose write fell through to memory', () => {
    // The failure mode this guards: a write that could not reach the store,
    // followed by a read the store answers with null.
    const storage = guardedStorage(readOnlyStorage())

    storage.write('theme', 'dark')

    expect(storage.read('theme')).toBe('dark')
  })

  it('returns null for an absent key', () => {
    expect(guardedStorage(hostileStorage()).read('absent')).toBeNull()
  })

  it('removes a value that fell through to memory', () => {
    const storage = guardedStorage(readOnlyStorage())

    storage.write('theme', 'dark')
    storage.remove('theme')

    expect(storage.read('theme')).toBeNull()
  })

  it('tolerates a removal the underlying store refuses', () => {
    expect(() => {
      guardedStorage(hostileStorage()).remove('theme')
    }).not.toThrow()
  })
})

describe('persistentStorage', () => {
  it('round-trips through the browser store', () => {
    const storage = persistentStorage()

    storage.write('round-trip', 'value')

    expect(storage.read('round-trip')).toBe('value')

    storage.remove('round-trip')

    expect(storage.read('round-trip')).toBeNull()
  })
})

describe('persistentStorage when the browser denies access', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')

  afterEach(() => {
    if (original) {
      Object.defineProperty(globalThis, 'localStorage', original)
    }
    vi.unstubAllGlobals()
  })

  it('falls back to memory when reading the store itself throws', () => {
    // Some privacy modes throw on property access, before any method is called.
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: fail,
    })

    const storage = persistentStorage()
    storage.write('theme', 'dark')

    expect(storage.read('theme')).toBe('dark')
  })
})
