import type { TeamReport } from './use-team-report'

/**
 * What the screen is showing, as a value rather than as a chain of conditions.
 *
 * Six states is more than a legible ternary chain, `sonarjs` forbids nesting
 * them, and a six-arm `switch` sits on the complexity ceiling on its own. A
 * discriminated union computed here keeps the branch in one tested place and
 * leaves the component a lookup.
 */
export type ScreenState =
  | { readonly kind: 'choose-group' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'report' }
  | { readonly kind: 'unreadable-group' }

interface ScreenStateInput {
  readonly group: string
  readonly report: TeamReport
}

/**
 * Which of them it is.
 *
 * Order matters. A group nobody chose is not an empty report; a report still
 * arriving is not an empty one either; and a group that resolved to nothing is
 * distinguished from one that resolved to a group with no hours in it, because
 * those are different things to tell a reader.
 */
export function screenStateOf({ group, report }: ScreenStateInput): ScreenState {
  if (group === '') {
    return { kind: 'choose-group' }
  }

  if (report.empty) {
    return { kind: 'loading' }
  }

  if (report.group === null) {
    return { kind: 'unreadable-group' }
  }

  return report.grid.rows.length === 0 ? { kind: 'empty' } : { kind: 'report' }
}
