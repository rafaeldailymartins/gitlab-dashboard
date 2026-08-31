import { describe, expect, it } from 'vitest'

import { isoDate } from '@/shared/lib/date'

import type { DayTotal, WorkItemTotal } from './aggregate'

import { itemTotals, projectSplit, projectTotals } from './rollup'

const SECONDS_PER_HOUR = 3600

const FISCAL = {
  fullPath: 'invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
  name: 'inventariofiscal',
  webUrl: 'https://gitlab.com/invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
}

/** Same name, different group: the case that makes the full path the key. */
const OTHER_FISCAL = {
  fullPath: 'invent-software/legacy/inventariofiscal',
  name: 'inventariofiscal',
  webUrl: 'https://gitlab.com/invent-software/legacy/inventariofiscal',
}

function day(date: string, items: WorkItemTotal[]): DayTotal {
  const seconds = items.reduce((total, entry) => total + entry.seconds, 0)

  return {
    date: isoDate(date),
    entryCount: items.length,
    hours: seconds / SECONDS_PER_HOUR,
    items,
    seconds,
  }
}

function item(
  hours: number,
  reference: null | string,
  project: WorkItemTotal['project'] = FISCAL,
): WorkItemTotal {
  return {
    entryCount: 1,
    hours,
    project,
    seconds: hours * SECONDS_PER_HOUR,
    workItem:
      reference === null
        ? null
        : {
            kind: 'issue',
            reference,
            title: `Work on ${reference}`,
            webUrl: `https://gitlab.com/${reference}`,
          },
  }
}

describe('projectTotals', () => {
  it('is empty for no days', () => {
    expect(projectTotals([])).toEqual([])
  })

  it('sums a project across the days it appears in', () => {
    const days = [day('2026-08-20', [item(4, 'a')]), day('2026-08-19', [item(2.5, 'b')])]

    expect(projectTotals(days)).toHaveLength(1)
    expect(projectTotals(days).at(0)?.hours).toBe(6.5)
  })

  it('lists the busiest project first', () => {
    const days = [day('2026-08-20', [item(1, 'a'), item(5, 'b', OTHER_FISCAL)])]

    expect(projectTotals(days).at(0)?.project?.fullPath).toBe(OTHER_FISCAL.fullPath)
  })

  it('keeps two projects with the same name apart', () => {
    const days = [day('2026-08-20', [item(1, 'a'), item(2, 'b', OTHER_FISCAL)])]

    expect(projectTotals(days)).toHaveLength(2)
  })

  it('reports a share of the period that sums to one', () => {
    const days = [day('2026-08-20', [item(3, 'a'), item(1, 'b', OTHER_FISCAL)])]
    const shares = projectTotals(days).map((total) => total.share)

    expect(shares).toEqual([0.75, 0.25])
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(1)
  })

  it('splits the whole period and nothing else', () => {
    const days = [day('2026-08-20', [item(3, 'a')]), day('2026-08-19', [item(1.5, 'b')])]
    const summed = projectTotals(days).reduce((total, entry) => total + entry.seconds, 0)

    expect(summed).toBe(days.reduce((total, entry) => total + entry.seconds, 0))
  })

  it('has no share to report when nothing was logged', () => {
    expect(projectTotals([day('2026-08-20', [item(0, 'a')])]).at(0)?.share).toBe(0)
  })

  it('counts unattributed time under its project like anything else', () => {
    expect(projectTotals([day('2026-08-20', [item(2, null)])]).at(0)?.hours).toBe(2)
  })
})

describe('itemTotals', () => {
  it('is empty for no days', () => {
    expect(itemTotals([])).toEqual([])
  })

  it('sums a work item across the days it appears in', () => {
    const days = [day('2026-08-20', [item(4, 'a')]), day('2026-08-19', [item(2.5, 'a')])]

    expect(itemTotals(days)).toHaveLength(1)
    expect(itemTotals(days).at(0)?.hours).toBe(6.5)
  })

  it('counts how many days an item was worked on', () => {
    const days = [day('2026-08-20', [item(4, 'a')]), day('2026-08-19', [item(2, 'a')])]

    expect(itemTotals(days).at(0)?.days).toBe(2)
  })

  it('lists the busiest item first', () => {
    const days = [day('2026-08-20', [item(1, 'a'), item(5, 'b')])]

    expect(itemTotals(days).map((total) => total.workItem?.reference)).toEqual(['b', 'a'])
  })

  it('keeps unattributed time as its own row, per project', () => {
    const days = [day('2026-08-20', [item(1, null), item(2, null, OTHER_FISCAL)])]

    expect(itemTotals(days)).toHaveLength(2)
    expect(itemTotals(days).every((total) => total.workItem === null)).toBe(true)
  })

  it('carries the project each item belongs to', () => {
    expect(itemTotals([day('2026-08-20', [item(1, 'a')])]).at(0)?.project).toEqual(FISCAL)
  })

  it('accounts for every second the days hold', () => {
    const days = [
      day('2026-08-20', [item(3, 'a'), item(1, null)]),
      day('2026-08-19', [item(2, 'a')]),
    ]
    const summed = itemTotals(days).reduce((total, entry) => total + entry.seconds, 0)

    expect(summed).toBe(6 * SECONDS_PER_HOUR)
  })
})

describe('projectSplit', () => {
  it('is empty for no days', () => {
    expect(projectSplit([], 6)).toEqual({ others: null, top: [] })
  })

  it('names every project while they fit', () => {
    const days = [day('2026-08-20', [item(1, 'a'), item(2, 'b', OTHER_FISCAL)])]

    expect(projectSplit(days, 6).top).toHaveLength(2)
    expect(projectSplit(days, 6).others).toBeNull()
  })

  it('folds the projects past the limit into one row', () => {
    const days = [day('2026-08-20', [item(3, 'a'), item(2, 'b', OTHER_FISCAL)])]

    const split = projectSplit(days, 1)

    expect(split.top).toHaveLength(1)
    expect(split.others).toMatchObject({ count: 1, hours: 2 })
  })

  it('accounts for the whole period across both halves', () => {
    const third = { fullPath: 'group/third', name: 'third', webUrl: 'https://gitlab.example/third' }
    const days = [
      day('2026-08-20', [item(4, 'a'), item(2, 'b', OTHER_FISCAL), item(1, 'c', third)]),
    ]

    // Four hours named, three folded: seven, which is what the day holds.
    expect(projectSplit(days, 1)).toMatchObject({
      others: { seconds: 3 * SECONDS_PER_HOUR },
      top: [{ seconds: 4 * SECONDS_PER_HOUR }],
    })
  })

  it('folds in seconds, so the folded hours are not a sum of rounded ones', () => {
    const third = { fullPath: 'group/third', name: 'third', webUrl: 'https://gitlab.example/third' }
    const days = [
      day('2026-08-20', [
        item(4, 'a'),
        { ...item(0, 'b', OTHER_FISCAL), hours: 0.03, seconds: 100 },
        { ...item(0, 'c', third), hours: 0.03, seconds: 100 },
      ]),
    ]

    // Two rows of 0.03 h are 0.06 h when rounded first, and 0.06 h here too —
    // but 200 seconds is what is actually carried.
    expect(projectSplit(days, 1).others).toMatchObject({ count: 2, seconds: 200 })
  })
})

describe('projects that could not be read', () => {
  it('are one group, however many they were', () => {
    const days = [day('2026-08-20', [item(1, 'a', null), item(2, 'b', null)])]

    const totals = projectTotals(days)

    expect(totals).toHaveLength(1)
    expect(totals.at(0)?.project).toBeNull()
    expect(totals.at(0)?.hours).toBe(3)
  })

  it('stay apart from a project that could be read', () => {
    const days = [day('2026-08-20', [item(1, 'a', null), item(2, 'b', FISCAL)])]

    expect(projectTotals(days)).toHaveLength(2)
  })

  it('carry their share of the period like any other group', () => {
    const days = [day('2026-08-20', [item(1, 'a', null), item(3, 'b', FISCAL)])]

    expect(projectTotals(days).find((total) => total.project === null)?.share).toBe(0.25)
  })

  it('keep an item total figure, with no project on the row', () => {
    const days = [day('2026-08-20', [item(2, 'a', null)])]

    const totals = itemTotals(days)

    expect(totals.at(0)?.project).toBeNull()
    expect(totals.at(0)?.hours).toBe(2)
  })
})

describe('unattributed time in a project that could not be read', () => {
  it('is rolled up as one item rather than throwing', () => {
    const days = [
      day('2026-08-20', [item(2, null, null)]),
      day('2026-08-19', [item(1, null, null)]),
    ]

    const totals = itemTotals(days)

    expect(totals).toHaveLength(1)
    expect(totals.at(0)?.days).toBe(2)
    expect(totals.at(0)?.project).toBeNull()
  })
})
