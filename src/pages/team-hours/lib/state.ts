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
  /** The session predates the identity scope, so the store cannot answer yet. */
  | { readonly kind: 'reconnect' }
  | { readonly kind: 'report' }
  /** The store would not say what teams this reader has. */
  | { readonly kind: 'teams-unavailable' }
  /** The address names a team this reader does not have. */
  | { readonly kind: 'unknown-team' }

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
 * from a team whose people logged nothing, because those are different things
 * to tell a reader.
 *
 * A group the reader cannot open is **not** one of these states. It drops the
 * narrowing rather than the report: an unreadable scope and an empty scoped
 * report are different facts, and the reader came for the figures. The screen
 * says the scope was dropped, above figures that are real.
 */
export function screenStateOf({ choice, report, saved }: ScreenStateInput): ScreenState {
  if (saved.loading) {
    return { kind: 'loading' }
  }

  if (saved.failure) {
    // A session granted before this app asked for an identity is not a broken
    // one: everything else it authorises still works, and authorising once more
    // repairs it. Saying "unavailable" would send the reader looking for an
    // outage, and signing them out would lose their place for no gain.
    return {
      kind: saved.failure.kind === 'identity-unavailable' ? 'reconnect' : 'teams-unavailable',
    }
  }

  if (choice.kind !== 'chosen') {
    return { kind: choice.kind === 'none' ? 'no-teams' : 'unknown-team' }
  }

  if (choice.team.members.length === 0) {
    return { kind: 'empty-team' }
  }

  return report.empty ? { kind: 'loading' } : { kind: 'report' }
}
