/**
 * Advisories accepted in the tooling tree, each with the reason it cannot reach
 * a reader and the day that reason was last checked.
 *
 * Nothing here can excuse a production dependency: `bun audit --prod` runs
 * first, with no exceptions at all, so a package a reader's browser or the
 * functions load fails the gate whatever this list says. An entry is for a
 * package only the build, the linters or the test runners install — and only
 * when there is no fixed version to move to. When there is one, upgrade.
 *
 * An entry is not permanent. The gate fails once one stops matching an
 * advisory the audit reports, so it is deleted rather than left to excuse
 * whatever is published next under the same package, and once its review is
 * older than `REVIEW_DAYS` in `scripts/check-audit.ts`, so somebody looks again.
 */
export interface AcceptedAdvisory {
  /** The GitHub advisory id, as the audit's URL names it. */
  readonly advisory: string
  readonly package: string
  /** Why it cannot reach a reader here — not why it is inconvenient to fix. */
  readonly reason: string
  /** `YYYY-MM-DD`: the last day somebody confirmed the reason still holds. */
  readonly reviewed: string
}

export const ACCEPTED: readonly AcceptedAdvisory[] = [
  {
    advisory: 'GHSA-vfj7-8cjw-p6xm',
    package: 'braces',
    reason:
      'Stack exhaustion from deeply nested brace patterns. No release fixes it: 3.0.3 is ' +
      'the newest braces and the advisory covers it. It is installed only through ' +
      'micromatch, by eslint-plugin-boundaries, steiger, @fission-ai/openspec and ' +
      'type-coverage, which expand glob patterns written in this repository’s own ' +
      'configuration — never one a reader or a request supplies — and it is in no ' +
      'production dependency, which `bun audit --prod` proves on every run.',
    reviewed: '2026-10-05',
  },
]
