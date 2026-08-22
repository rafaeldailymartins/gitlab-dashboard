/**
 * Wraps an operation so concurrent callers share one run.
 *
 * While a run is in flight every caller receives that same promise; once it
 * settles the next call starts a fresh one. Nothing is cached — this is about
 * not doing the work twice at the same moment, not about remembering results.
 *
 * Token renewal is the case that demands it: GitLab rotates the refresh token
 * on every use, so four simultaneous renewals would invalidate each other and
 * sign the reader out.
 */
export function singleFlight<T>(operation: () => Promise<T>): () => Promise<T> {
  let inFlight: null | Promise<T> = null

  return () => {
    inFlight ??= operation().finally(() => {
      inFlight = null
    })

    return inFlight
  }
}
