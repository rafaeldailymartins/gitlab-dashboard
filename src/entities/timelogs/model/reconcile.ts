import type { TimelogEntry } from './types'

/**
 * The entries in `candidates` that `read` does not already account for.
 *
 * The provider withholds an entry entirely when it cannot resolve the entry's
 * project, so a page has to be asked for again without that field to recover
 * what was in it. Both answers then describe the same page, and the entries
 * worth keeping are the surplus of the second over the first.
 *
 * Matching is by what is readable about an entry — its instant, its duration,
 * its work item and its summary — and not by position. The two requests are not
 * atomic: an entry logged between them shifts every position on the newest page,
 * and the entry at a withheld position in the second answer is then one the
 * first answer already returned. Taking it would count its hours twice, and a
 * figure that is too high makes every other figure on the screen untrustworthy.
 *
 * Counts are compared rather than membership, because two entries can be
 * identical on every readable field — same instant, same duration, same item, no
 * summary — and comparing membership would silently drop the second one.
 *
 * `limit` is how many entries the provider withheld, and nothing beyond that is
 * taken. It makes drift one-directional: the worst a shifted page can do is
 * leave an entry unrecovered, which the report says out loud, rather than
 * inventing one, which nothing would.
 */
export function recoveredEntries(
  read: readonly TimelogEntry[],
  candidates: readonly TimelogEntry[],
  limit: number,
): TimelogEntry[] {
  const unmatched = countsOf(read)
  const recovered: TimelogEntry[] = []

  for (const candidate of candidates) {
    if (recovered.length >= limit) {
      break
    }

    if (!consume(unmatched, keyOf(candidate))) {
      recovered.push(candidate)
    }
  }

  return recovered
}

/**
 * Spends one of `key`'s remaining matches, and says whether there was one.
 *
 * A spent match cannot be spent again, which is what makes two identical entries
 * cancel exactly two candidates rather than all of them.
 */
function consume(counts: Map<string, number>, key: string): boolean {
  const remaining = counts.get(key) ?? 0

  if (remaining === 0) {
    return false
  }

  counts.set(key, remaining - 1)

  return true
}

function countsOf(entries: readonly TimelogEntry[]): Map<string, number> {
  const counts = new Map<string, number>()

  for (const entry of entries) {
    const key = keyOf(entry)

    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return counts
}

/**
 * Everything about an entry that both answers agree on.
 *
 * The project is deliberately absent: the second answer never carries one, so
 * including it would make every candidate look new.
 *
 * Encoded rather than joined with a separator. A summary is whatever the reader
 * typed after `/spend`, so any separator could also appear inside one, and two
 * different entries would then produce the same key; a quoted, escaped encoding
 * cannot be ambiguous.
 */
function keyOf(entry: TimelogEntry): string {
  return JSON.stringify([
    entry.spentAt.getTime(),
    entry.seconds,
    entry.workItem?.reference ?? null,
    entry.summary,
  ])
}
