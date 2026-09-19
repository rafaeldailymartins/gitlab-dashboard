import type { Team } from './team'

/**
 * What the app needs of whoever can prove who the reader is.
 *
 * Two methods rather than the whole session manager, so this slice can be
 * exercised without one — and so it does not reach into another entity, which
 * FSD forbids and which it has no need to do.
 */
export interface Identified {
  /**
   * @throws unknown when there is no assertion to be had. The reason is the
   *   session's own and means nothing here, so every rejection is read as
   *   `identity-unavailable` — see `api/teams-gateway.ts`.
   */
  identityToken(): Promise<string>
  /** Discards the held credential and returns a fresh one. */
  refresh(): Promise<string>
}

/**
 * The reader's teams, and the version they were read at.
 *
 * The version is opaque: whatever the store handed over, handed back unread. It
 * is what makes a write conditional, and last write wins over a whole roster
 * silently drops a colleague off it.
 */
export interface TeamsDocument {
  /** Null when nothing is stored yet, which is what a first write asserts. */
  readonly etag: null | string
  readonly teams: readonly Team[]
}

/** Why a read or a write did not produce a document. */
export type TeamsFailure =
  /** The version written against is no longer current. `current` is what is. */
  | { readonly current: TeamsDocument; readonly kind: 'conflict' }
  /**
   * The session carries no identity this app can prove.
   *
   * It was granted before the application asked for one, and renewing carries
   * the original scopes forward — so it never will. Authorising once more
   * repairs it; signing out would only lose the reader their place.
   */
  | { readonly kind: 'identity-unavailable' }
  /** The store refused the request itself. Retrying it unchanged will not help. */
  | { readonly kind: 'rejected' }
  /** The store could not be reached, or would not answer. Worth retrying. */
  | { readonly kind: 'unavailable' }

export interface TeamsGateway {
  read(signal?: AbortSignal): Promise<TeamsDocument>
  write(document: TeamsDocument, signal?: AbortSignal): Promise<TeamsDocument>
}

/** A read or a write that did not land, carrying why. */
export class TeamsError extends Error {
  readonly failure: TeamsFailure

  constructor(failure: TeamsFailure) {
    super(failure.kind)
    this.name = 'TeamsError'
    this.failure = failure
  }
}
