import type { StoredPreferences } from './preferences'

/**
 * What this slice needs of whoever can prove who the reader is.
 *
 * Two methods rather than the whole session manager, so this slice can be
 * exercised without one — and so it does not reach into another entity, which
 * FSD forbids and which it has no need to do. `entities/teams` declares the
 * same pair for the same reason; the duplication is two method signatures and
 * the alternative is a cross-slice import.
 */
export interface Identified {
  /**
   * @throws unknown when there is no assertion to be had. The reason is the
   *   session's own and means nothing here.
   */
  identityToken(): Promise<string>
  /** Discards the held credential and returns a fresh one. */
  refresh(): Promise<string>
}

/**
 * The reader's settings as the store holds them, and the version they were read
 * at.
 *
 * `settings` is null when the store has never heard of this reader. That is not
 * the same as defaults and must not be collapsed into them: a device holding
 * defaults it has never synced should send them, and one that has should not be
 * told the store disagrees.
 *
 * The version is opaque — whatever the store handed over, handed back unread.
 * It is what makes a write conditional, which is what the gateway turns into
 * last-write-wins rather than a refusal the reader has to resolve.
 */
export interface PreferencesDocument {
  /** Null when nothing is stored yet, which is what a first write asserts. */
  readonly etag: null | string
  readonly settings: null | StoredPreferences
}

/**
 * Carries the settings between devices, and nothing else.
 *
 * There is no failure type and no error class here, deliberately. Every way this
 * can fail means the same thing to every caller — the settings in front of the
 * reader are the device's own, which is what they were before any of this
 * existed — so a rejection carries no information worth a union to discriminate.
 * `entities/teams` needs one because a conflict there is a fact the reader must
 * see; here a conflict is resolved without them.
 */
export interface PreferencesGateway {
  read(signal?: AbortSignal): Promise<PreferencesDocument>
  /**
   * Stores `settings`, resolving a race rather than reporting one.
   *
   * Answers whatever is stored afterwards, which is the caller's cue to adopt:
   * it is the reader's own document when this write won, and the other device's
   * when it did not.
   */
  write(document: PreferencesDocument, signal?: AbortSignal): Promise<PreferencesDocument>
}
