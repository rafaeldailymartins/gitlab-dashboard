import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import type { TimelogEntry } from './types'

import { recoveredEntries } from './reconcile'

/**
 * The rules `recoveredEntries` promises for any two answers, not for the few
 * that `reconcile.test.ts` spells out.
 *
 * The values are drawn from small pools on purpose. Entries identical on every
 * readable field are the case the multiset exists for, and a generator over the
 * whole space of instants and summaries would almost never produce two of them.
 * The summaries include the characters a joined key would have been fooled by.
 */
const entryArbitrary: fc.Arbitrary<TimelogEntry> = fc.record({
  project: fc.constant(null),
  seconds: fc.constantFrom(-3600, 900, 3600, 7200),
  spentAt: fc.constantFrom(
    new Date('2026-08-19T15:00:00Z'),
    new Date('2026-08-20T15:00:00Z'),
    new Date('2026-08-20T23:59:59Z'),
  ),
  summary: fc.constantFrom(null, '', 'review', 'a","b', '|'),
  workItem: fc.option(
    fc.constantFrom('group/project#1', 'group/project!2').map((reference) => ({
      kind: reference.includes('!') ? ('merge-request' as const) : ('issue' as const),
      reference,
      title: reference,
      webUrl: `https://gitlab.com/${reference}`,
    })),
  ),
})

const entriesArbitrary = fc.array(entryArbitrary, { maxLength: 12 })

/** A page read twice with nothing logged in between: every withheld entry is among the candidates. */
const unmovedPage = fc.tuple(entriesArbitrary, entriesArbitrary).chain(pageOf)

function countsOf(entries: readonly TimelogEntry[]): Map<string, number> {
  const counts = new Map<string, number>()

  for (const entry of entries) {
    counts.set(keyOf(entry), (counts.get(keyOf(entry)) ?? 0) + 1)
  }

  return counts
}

function isIncreasing(numbers: readonly number[]): boolean {
  return numbers.every((value, index) => index === 0 || value > (numbers[index - 1] ?? value))
}

function keyOf(entry: TimelogEntry): string {
  return JSON.stringify([
    entry.spentAt.getTime(),
    entry.seconds,
    entry.workItem?.reference ?? null,
    entry.summary,
  ])
}

function pageOf([read, withheld]: [TimelogEntry[], TimelogEntry[]]) {
  const all = [...read, ...withheld]

  return fc
    .shuffledSubarray(all, { minLength: all.length })
    .map((candidates) => ({ candidates, read, withheld }))
}

/** Where each of `found` sits in `list`, by identity rather than by value. */
function positionsIn(list: readonly TimelogEntry[], found: readonly TimelogEntry[]): number[] {
  return found.map((entry) => list.indexOf(entry))
}

describe('recoveredEntries, for any answers', () => {
  it('takes no more than the provider said it withheld', () => {
    fc.assert(
      fc.property(entriesArbitrary, entriesArbitrary, fc.nat(15), (read, candidates, limit) => {
        expect(recoveredEntries(read, candidates, limit).length).toBeLessThanOrEqual(limit)
      }),
    )
  })

  it('returns candidates, in the order they arrived', () => {
    fc.assert(
      fc.property(entriesArbitrary, entriesArbitrary, fc.nat(15), (read, candidates, limit) => {
        const recovered = recoveredEntries(read, candidates, limit)

        expect(isIncreasing(positionsIn(candidates, recovered))).toBe(true)
      }),
    )
  })

  it('never counts an entry the first answer already returned', () => {
    fc.assert(
      fc.property(entriesArbitrary, entriesArbitrary, fc.nat(15), (read, candidates, limit) => {
        const recovered = countsOf(recoveredEntries(read, candidates, limit))
        const offered = countsOf(candidates)
        const known = countsOf(read)

        for (const [key, count] of recovered) {
          expect(count).toBeLessThanOrEqual((offered.get(key) ?? 0) - (known.get(key) ?? 0))
        }
      }),
    )
  })

  it('recovers exactly the withheld entries when the page did not move', () => {
    fc.assert(
      fc.property(unmovedPage, ({ candidates, read, withheld }) => {
        const recovered = recoveredEntries(read, candidates, withheld.length)

        expect(countsOf(recovered)).toEqual(countsOf(withheld))
      }),
    )
  })
})
