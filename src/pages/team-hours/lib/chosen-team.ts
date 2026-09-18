import type { Team } from '@/entities/teams'

/**
 * Which team the address names, and what to say when it names none.
 *
 * Three answers rather than `Team | null`, because the three mean different
 * things to a reader and only one of them is an error. Somebody with no teams
 * yet is at the beginning; somebody following a link to a team that has since
 * been deleted needs to be told that, not shown their own first team under
 * somebody else's link.
 */
export type TeamChoice =
  | { readonly kind: 'chosen'; readonly team: Team }
  /** The reader keeps no teams at all. */
  | { readonly kind: 'none' }
  /** The address names a team this reader does not have. */
  | { readonly kind: 'unknown' }

/**
 * The team an address names.
 *
 * An address that names one always wins, exactly as the group address used to:
 * a link somebody sent outranks this reader's habit, and it outranks a
 * convenient fallback even when the team is gone. Naming none falls back to the
 * first team the reader keeps, which is the only choice available that is not
 * an empty screen.
 */
export function chosenTeam(teams: readonly Team[], id: string): TeamChoice {
  if (id === '') {
    const [first] = teams

    return first ? { kind: 'chosen', team: first } : { kind: 'none' }
  }

  const named = teams.find((team) => team.id === id)

  return named ? { kind: 'chosen', team: named } : { kind: 'unknown' }
}

/** The chosen team, or null. For the places that only need the team itself. */
export function teamOf(choice: TeamChoice): null | Team {
  return choice.kind === 'chosen' ? choice.team : null
}
