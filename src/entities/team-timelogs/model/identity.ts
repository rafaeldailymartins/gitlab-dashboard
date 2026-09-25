import type { Member, Person } from './types'

/**
 * What the provider said when asked about somebody a team names.
 *
 * There is no arm for "this identifier now belongs to a different person",
 * because asking by identifier makes that unexpressible: the provider resolves
 * the node for the id it was given or resolves nothing. That is the whole
 * benefit of addressing by the identifier rather than merely storing it — a
 * class of bug stops needing to be detected.
 */
export type MemberIdentity =
  /** The provider resolved them. `person` is what it says they are called now. */
  | { readonly kind: 'confirmed'; readonly person: Person }
  /**
   * Nothing came back for them.
   *
   * Deleted, blocked, or simply beyond this reader — indistinguishable from
   * here, and all three mean the same thing to the screen: nothing is known.
   * Which is not zero. A row drawing zero here would be this app claiming
   * somebody logged nothing on the strength of an answer it never got.
   */
  | { readonly kind: 'unresolved' }

/**
 * How to match a stored member against what the provider resolved.
 *
 * Matched on the returned identifier, never on position. The provider promises
 * no order and returns fewer nodes than it was asked identifiers when one
 * resolves to nothing, so comparing the two sets is the only way to learn which
 * ones are missing — and what makes `unresolved` a fact rather than an
 * inference.
 *
 * A lookup rather than a map keyed by member, so every member has an answer by
 * construction. A map would hand its caller `MemberIdentity | undefined` and a
 * fallback arm no answer can reach — a row silently mislabelled if it ever did.
 *
 * A resolved person whose username differs from the stored one is `confirmed`
 * all the same: a rename is somebody changing their handle, not an error, and
 * the interface shows what the provider now says.
 */
export function identityLookup(resolved: readonly Person[]): (member: Member) => MemberIdentity {
  const byId = new Map(resolved.map((person) => [person.id, person]))

  return (member) => {
    const person = byId.get(member.id)

    return person ? { kind: 'confirmed', person } : { kind: 'unresolved' }
  }
}

/** The resolved person behind a row, or null when there is none to link to. */
export function personOf(identity: MemberIdentity): null | Person {
  return identity.kind === 'confirmed' ? identity.person : null
}
