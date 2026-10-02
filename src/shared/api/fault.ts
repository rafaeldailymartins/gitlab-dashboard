import { CancelledError } from '@tanstack/react-query'

import { GraphQLRequestError } from './graphql'

/** Something that went wrong and that the author should hear about. */
export interface Fault {
  readonly error: Error
  /** Which way it went wrong. A tag on the report, never the reader's data. */
  readonly kind: 'rejected' | 'unavailable' | 'unexpected'
}

/**
 * Whether a failed request is a fault, and which kind.
 *
 * **A credential GitLab no longer accepts is not one.** It is the session
 * ending, the app already asks the reader to sign in again, and reporting it
 * would bury every real fault under each reader's expired token (OBS-1). A
 * request the app called off is not one either: it is the app changing its mind.
 *
 * A refusal is reported by its kind alone. The messages GitLab sent can name
 * the people or the groups the request was about, so the fault carries a copy of
 * the error without them, keeping its stack. `scrub` would not send them either,
 * since it sends an error's own message and nothing it carries — this is the
 * same rule held one step earlier, so a reporter that serialised the whole error
 * would still have nothing to leak.
 */
export function faultOf(error: unknown): Fault | null {
  if (
    error instanceof CancelledError ||
    (error instanceof DOMException && error.name === 'AbortError')
  ) {
    return null
  }

  if (error instanceof GraphQLRequestError) {
    return error.failure.kind === 'unauthorized' ? null : withoutMessages(error)
  }

  return {
    error: error instanceof Error ? error : new Error('A value that is not an error was thrown'),
    kind: 'unexpected',
  }
}

function withoutMessages(error: GraphQLRequestError): Fault {
  const kind = error.failure.kind === 'rejected' ? 'rejected' : 'unavailable'
  const copy = new GraphQLRequestError(
    kind === 'rejected' ? { kind, messages: [] } : { kind: 'unavailable' },
  )

  // Defined rather than assigned: `stack` is optional, and the original may
  // have none to give.
  Object.defineProperty(copy, 'stack', { configurable: true, value: error.stack, writable: true })

  return { error: copy, kind }
}
