import type { StoredPreferences } from './preferences'

/**
 * What a device should do with what the store answered.
 *
 * Three answers rather than a boolean, because "do nothing" and "the store is
 * already right" are the same act and "send mine" is not, and a caller that had
 * to derive the third from a comparison would be the second place this rule
 * lives.
 */
export type Reconciliation =
  /** The store is newer, or knows something this device does not: take it. */
  | 'adopt'
  /** They agree, or there is nothing anywhere to agree about. */
  | 'agree'
  /** The device is newer, or the store holds nothing: send it. */
  | 'push'

/**
 * Last write wins, decided by the instant recorded with the settings.
 *
 * Deliberately not how a team is reconciled. A roster is edited by somebody
 * watching it, and silently dropping a colleague from one is the worst thing
 * that surface can do — so a stale write there is refused and reported. A
 * preference changes in the background, one field at a time, from a form nobody
 * is waiting on for a verdict; what a race costs is one number the reader can
 * see and set again, and a dialog about it would be a dialog over nothing.
 *
 * **A device that has never recorded an instant does not compete.** It adopts
 * whatever the store holds, and pushes only when the store holds nothing at
 * all. Both halves matter and they are not symmetric:
 *
 * - Adopting is what stops a fresh install — defaults, no instant — from
 *   pushing those defaults over settings the reader really set on another
 *   machine. An unknown instant is not an old one, and dating it to the epoch
 *   said "1970" about a document nobody dated.
 * - Pushing against an empty store is what carries settings a device was
 *   already holding before any of this existed, without waiting for the reader
 *   to touch a field.
 *
 * Two devices that had both never recorded one used to answer `agree` while
 * holding different settings, so neither adopted and the two drifted apart in
 * silence. Now the first to reach an empty store fills it and the other adopts.
 * What that push carries has to be **dated** on its way out, since a document
 * nothing can order is not one the store may keep — and dating it is a clock,
 * which this layer may not reach for. `lib/use-preferences-sync.ts` stamps it.
 *
 * Equal instants answer `agree` rather than `push`. Two documents stamped the
 * same millisecond are the same document in every case this app can produce —
 * one device that wrote and read itself back — and answering `push` there would
 * make an idle tab write on every reconciliation.
 */
export function reconcile(
  local: StoredPreferences,
  remote: null | StoredPreferences,
): Reconciliation {
  if (local.updatedAt === null) {
    return remote === null ? 'push' : 'adopt'
  }

  const stamped = remote === null ? null : remote.updatedAt

  if (stamped === null) {
    return 'push'
  }

  const here = Date.parse(local.updatedAt)
  const there = Date.parse(stamped)

  if (here === there) {
    return 'agree'
  }

  return here > there ? 'push' : 'adopt'
}
