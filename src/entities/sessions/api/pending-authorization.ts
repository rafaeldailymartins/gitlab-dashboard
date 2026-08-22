import type { KeyValueStorage } from '@/shared/lib/storage'

const PENDING_KEY = 'gitlab.pendingAuthorization'

export interface PendingAuthorizationStore {
  /** Reads and discards in one step: a request may only be completed once. */
  consume(): null | PendingAuthorization
  write(pending: PendingAuthorization): void
}

/** What has to survive the round trip out to GitLab and back. */
interface PendingAuthorization {
  /** Where the reader was heading before being asked to sign in. */
  readonly destination: string
  readonly state: string
  readonly verifier: string
}

/**
 * Holds the verifier, the anti-forgery value and the intended destination
 * between the redirect out and the redirect back.
 *
 * `consume` removes as it reads, so a callback cannot be replayed: the second
 * attempt finds nothing pending and is refused.
 */
export function pendingAuthorizationStore(storage: KeyValueStorage): PendingAuthorizationStore {
  return {
    consume() {
      const stored = storage.read(PENDING_KEY)
      storage.remove(PENDING_KEY)

      return decode(stored)
    },

    write(pending) {
      storage.write(PENDING_KEY, JSON.stringify(pending))
    },
  }
}

function decode(stored: null | string): null | PendingAuthorization {
  if (stored === null) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(stored)

    return isPending(parsed) ? parsed : null
  } catch {
    return null
  }
}

function hasStringField(value: object, field: string): boolean {
  return typeof (value as Record<string, unknown>)[field] === 'string'
}

function isPending(value: unknown): value is PendingAuthorization {
  return (
    typeof value === 'object' &&
    value !== null &&
    hasStringField(value, 'destination') &&
    hasStringField(value, 'state') &&
    hasStringField(value, 'verifier')
  )
}
