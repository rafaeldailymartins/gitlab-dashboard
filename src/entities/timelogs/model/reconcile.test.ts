import { describe, expect, it } from 'vitest'

import type { TimelogEntry } from './types'

import { recoveredEntries } from './reconcile'

const PROJECT = {
  fullPath: 'invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
  name: 'inventariofiscal',
  webUrl: 'https://gitlab.com/invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
}

function entry(overrides: Partial<TimelogEntry> = {}): TimelogEntry {
  return {
    project: PROJECT,
    seconds: 3600,
    spentAt: new Date('2026-08-20T15:00:00Z'),
    summary: null,
    workItem: null,
    ...overrides,
  }
}

/** The same entry as the provider returns it when it will not resolve a project. */
function withoutProject(source: TimelogEntry): TimelogEntry {
  return { ...source, project: null }
}

describe('recoveredEntries', () => {
  it('recovers an entry the first answer did not return', () => {
    const kept = entry()
    const withheld = entry({ seconds: 7200, spentAt: new Date('2026-08-19T15:00:00Z') })

    const recovered = recoveredEntries(
      [kept],
      [kept, withheld].map((source) => withoutProject(source)),
      1,
    )

    expect(recovered).toEqual([withoutProject(withheld)])
  })

  it('counts an entry present in both answers once', () => {
    const read = [entry(), entry({ seconds: 7200 })]

    expect(
      recoveredEntries(
        read,
        read.map((source) => withoutProject(source)),
        0,
      ),
    ).toEqual([])
  })

  it('recovers both of two entries identical on every readable field', () => {
    const twin = entry()
    const read: TimelogEntry[] = []

    const recovered = recoveredEntries(
      read,
      [twin, twin].map((source) => withoutProject(source)),
      2,
    )

    expect(recovered).toHaveLength(2)
  })

  it('keeps one of two identical entries when the first answer returned one', () => {
    const twin = entry()

    const recovered = recoveredEntries(
      [twin],
      [twin, twin].map((source) => withoutProject(source)),
      1,
    )

    expect(recovered).toEqual([withoutProject(twin)])
  })

  it('never takes more entries than the provider withheld', () => {
    const read: TimelogEntry[] = []
    const candidates = [entry({ seconds: 100 }), entry({ seconds: 200 }), entry({ seconds: 300 })]

    const recovered = recoveredEntries(
      read,
      candidates.map((source) => withoutProject(source)),
      2,
    )

    expect(recovered).toHaveLength(2)
  })

  it('takes nothing when the provider withheld nothing', () => {
    const candidates = [entry({ seconds: 100 })]

    expect(
      recoveredEntries(
        [],
        candidates.map((source) => withoutProject(source)),
        0,
      ),
    ).toEqual([])
  })

  /**
   * The two requests are not atomic. If a new entry shifted the page between
   * them, matching by position would take an entry the first answer already
   * returned and count its hours twice. Matching by what is readable cannot.
   */
  it('does not count an entry twice when the page shifted between the answers', () => {
    const newest = entry({ seconds: 900, spentAt: new Date('2026-08-21T15:00:00Z') })
    const read = [entry(), entry({ seconds: 7200 })]
    const shifted = [newest, ...read].map((source) => withoutProject(source))

    const recovered = recoveredEntries(read, shifted, 1)

    expect(recovered).toEqual([withoutProject(newest)])
  })

  it('tells two entries apart by their work item', () => {
    const onAnItem = entry({
      workItem: {
        kind: 'issue',
        reference: `${PROJECT.fullPath}#128`,
        title: 'Totalizador',
        webUrl: `${PROJECT.webUrl}/-/work_items/128`,
      },
    })

    const recovered = recoveredEntries(
      [entry()],
      [entry(), onAnItem].map((source) => withoutProject(source)),
      1,
    )

    expect(recovered).toEqual([withoutProject(onAnItem)])
  })

  it('tells two entries apart by their summary', () => {
    const described = entry({ summary: 'Ajuste final da migration' })

    const recovered = recoveredEntries(
      [entry()],
      [entry(), described].map((source) => withoutProject(source)),
      1,
    )

    expect(recovered).toEqual([withoutProject(described)])
  })
})

/**
 * The work item is part of the key, not decoration. Without it, two entries that
 * differ only by which issue they were logged against are the same entry, and
 * one of them is dropped whenever the first answer already held a duplicate of
 * the other.
 */
describe('what makes two entries different', () => {
  const first = { kind: 'issue' as const, reference: 'group/project#1', title: 'One', webUrl: '' }
  const second = { kind: 'issue' as const, reference: 'group/project#2', title: 'Two', webUrl: '' }

  it('recovers an entry that differs only by its work item', () => {
    const read = [entry({ workItem: first }), entry({ workItem: first })]
    const candidates = [entry({ workItem: first }), entry({ workItem: second })].map((source) =>
      withoutProject(source),
    )

    const recovered = recoveredEntries(read, candidates, 1)

    expect(recovered).toEqual([withoutProject(entry({ workItem: second }))])
  })
})
