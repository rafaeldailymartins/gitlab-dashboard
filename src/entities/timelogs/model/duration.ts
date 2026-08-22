/** GitLab reports every timelog duration as a whole number of seconds. */
const SECONDS_PER_HOUR = 3600
const HUNDREDTHS_PER_UNIT = 100
const SECONDS_PER_HUNDREDTH_HOUR = SECONDS_PER_HOUR / HUNDREDTHS_PER_UNIT

/**
 * Converts a duration in seconds to hours, rounded to two decimals.
 *
 * Two decimals is the precision GitLab's own time tracking displays. Rounding
 * happens only here, at the edge of the domain: totals are accumulated in
 * seconds and converted once, so rounding error never compounds across a
 * period.
 *
 * Negative durations are supported because `/spend -1h` is how a GitLab user
 * corrects a mistaken entry. They round away from zero, so -0.005h and 0.005h
 * are treated symmetrically.
 *
 * @throws TypeError when `seconds` is not a finite number.
 */
export function secondsToHours(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    throw new TypeError(`Duration in seconds must be finite, received ${String(seconds)}`)
  }

  const hundredths = seconds / SECONDS_PER_HUNDREDTH_HOUR
  const rounded = Math.sign(hundredths) * Math.round(Math.abs(hundredths))

  // Without this, a tiny negative duration yields `-0`, which reads as "-0".
  return rounded === 0 ? 0 : rounded / HUNDREDTHS_PER_UNIT
}
