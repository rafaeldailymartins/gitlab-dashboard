import { byNameThenUsername } from '@/shared/lib/people'

import type { SuggestedMember } from './types'

/**
 * Who to offer when a reader seeds a team from a group.
 *
 * Whoever logged time there, not whoever is a member. A group's membership is an
 * access-control list: most of it may never have touched time tracking, and it
 * misses somebody who worked on an issue there without being on it. Measured on
 * one real squad, membership offered seventeen names of which eleven had no
 * hours at all, while eight people had logged — two of them not members.
 *
 * Deduplicated by the provider's identifier rather than by username, for the
 * reason a roster is stored that way: a username can change, and the same person
 * under two of them would be offered twice.
 *
 * Bots are dropped: nobody manages a bot's timesheet, and a reader who genuinely
 * wants one can add it by name. Accounts that are no longer active are **kept** —
 * one that logged time in the window did the work and has since been blocked or
 * left, which is the opposite of the clutter the membership rule removed.
 */
export function suggestionsFrom(observed: readonly SuggestedMember[]): readonly SuggestedMember[] {
  const byId = new Map<string, SuggestedMember>()

  for (const candidate of observed) {
    if (!candidate.bot && !byId.has(candidate.person.id)) {
      byId.set(candidate.person.id, candidate)
    }
  }

  return [...byId.values()].toSorted((left, right) => byNameThenUsername(left.person, right.person))
}
