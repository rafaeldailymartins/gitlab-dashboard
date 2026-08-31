/**
 * The project a timelog belongs to.
 *
 * GitLab reports one for every entry it is willing to resolve. An entry whose
 * project it refuses is withheld entirely and recovered without one, so a
 * reference is absent rather than incomplete.
 */
export interface ProjectRef {
  /** Group and project, for disambiguating two projects with the same name. */
  readonly fullPath: string
  /** The project's own name, without its group path. */
  readonly name: string
  readonly webUrl: string
}

/**
 * One timelog, normalised from what GitLab reports.
 *
 * `spentAt` is an instant, not a calendar date: which day it belongs to depends
 * on the reader's time zone, and only `dayTotals` decides that.
 */
export interface TimelogEntry {
  /**
   * Null when the provider would not resolve the project. The entry's hours are
   * still the reader's own, so they still count; see `reconcile.ts`.
   */
  readonly project: null | ProjectRef
  /** GitLab reports whole seconds. Negative values correct a mistaken entry. */
  readonly seconds: number
  readonly spentAt: Date
  /** Whatever the reader typed after `/spend`, if anything. */
  readonly summary: null | string
  /** Null when time was logged without an issue or a merge request. */
  readonly workItem: null | WorkItemRef
}

/** The issue or merge request time was logged against. */
export interface WorkItemRef {
  readonly kind: 'issue' | 'merge-request'
  /** GitLab's full reference, such as `group/project#128` or `group/project!34`. */
  readonly reference: string
  readonly title: string
  readonly webUrl: string
}
