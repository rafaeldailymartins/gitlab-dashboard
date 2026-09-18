import type { TeamChoice } from './chosen-team'
import type { SavedTeams } from './use-saved-teams'
import type { TeamHoursReport } from './use-team-report'

/**
 * What the screen is showing, as a value rather than as a chain of conditions.
 *
 * Seven states is more than a legible ternary chain, `sonarjs` forbids nesting
 * them, and a seven-arm `switch` sits on the complexity ceiling on its own. A
 * discriminated union computed here keeps the branch in one tested place and
 * leaves the component a lookup.
 */
export type ScreenState =
  /** Nobody is on the chosen team, so there is nothing to report on. */
  | { readonly kind: 'empty-team' }
  | { readonly kind: 'loading' }
  /** The reader keeps no teams yet. */
  | { readonly kind: 'no-teams' }
  | { readonly kind: 'report' }
  /** The store would not say what teams this reader has. */
  | { readonly kind: 'teams-unavailable' }
  /** The address names a team this reader does not have. */
  | { readonly kind: 'unknown-team' }
  /** The address names a group this reader cannot open. */
  | { readonly kind: 'unreadable-group' }

interface ScreenStateInput {
  readonly choice: TeamChoice
  readonly report: TeamHoursReport
  readonly saved: SavedTeams
}

/**
 * Which of them it is.
 *
 * Order matters, and it runs outward from what the reader can act on. The store
 * is asked about first because every other state presumes it answered; a
 * failure to reach it is not "you have no teams", which would invite somebody
 * to build one they already have. A team with nobody on it is distinguished
 * from a team whose people logged nothing, and a group nobody can open is
 * distinguished from a report with nothing in it, because those are different
 * things to tell a reader.
 */
export function screenStateOf({ choice, report, saved }: ScreenStateInput): ScreenState {
  if (saved.loading) {
    return { kind: 'loading' }
  }

  if (saved.failure) {
    return { kind: 'teams-unavailable' }
  }

  if (choice.kind !== 'chosen') {
    return { kind: choice.kind === 'none' ? 'no-teams' : 'unknown-team' }
  }

  if (report.scope === 'unreadable') {
    return { kind: 'unreadable-group' }
  }

  if (choice.team.members.length === 0) {
    return { kind: 'empty-team' }
  }

  return report.empty ? { kind: 'loading' } : { kind: 'report' }
}
