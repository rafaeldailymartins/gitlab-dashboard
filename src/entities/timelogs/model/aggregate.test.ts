import { describe, expect, it } from 'vitest'

import { isoDate } from '@/shared/lib/date'

import type { TimelogEntry } from './types'

import { dayTotals, entriesWithin, periodTotal } from './aggregate'

const SAO_PAULO = 'America/Sao_Paulo'
const TOKYO = 'Asia/Tokyo'

const FISCAL = {
  fullPath: 'invent-software/inventariofiscal',
  name: 'inventariofiscal',
  webUrl: 'https://gitlab.com/invent-software/inventariofiscal',
}

const WEB = {
  fullPath: 'invent-software/web',
  name: 'web',
  webUrl: 'https://gitlab.com/invent-software/web',
}

function entry(overrides: Partial<TimelogEntry> = {}): TimelogEntry {
  return {
    project: FISCAL,
    seconds: 3600,
    spentAt: new Date('2026-08-20T15:00:00Z'),
    summary: null,
    workItem: issue('invent-software/inventariofiscal#128'),
    ...overrides,
  }
}

function issue(reference: string, title = 'An issue') {
  return {
    kind: 'issue' as const,
    reference,
    title,
    webUrl: `https://gitlab.com/${reference}`,
  }
}

describe('periodTotal', () => {
  it('is empty for no entries', () => {
    expect(periodTotal([])).toEqual({ entryCount: 0, hours: 0, seconds: 0 })
  })

  it('sums seconds and converts once', () => {
    const total = periodTotal([entry({ seconds: 24_120 }), entry({ seconds: 24_300 })])

    expect(total.seconds).toBe(48_420)
    expect(total.hours).toBe(13.45)
    expect(total.entryCount).toBe(2)
  })

  it('never compounds rounding across entries', () => {
    // Each of these is 0.03h once rounded; three of them are 0.08h, not 0.09h.
    const total = periodTotal([
      entry({ seconds: 100 }),
      entry({ seconds: 100 }),
      entry({ seconds: 100 }),
    ])

    expect(total.seconds).toBe(300)
    expect(total.hours).toBe(0.08)
  })

  it('counts a correction as the negative it is', () => {
    const total = periodTotal([entry({ seconds: 7200 }), entry({ seconds: -3600 })])

    expect(total.seconds).toBe(3600)
    expect(total.hours).toBe(1)
  })
})

describe('entriesWithin', () => {
  const range = { from: isoDate('2026-08-19'), to: isoDate('2026-08-21') }

  it('keeps an entry inside the range', () => {
    const kept = entriesWithin([entry()], range, SAO_PAULO)

    expect(kept).toHaveLength(1)
  })

  it('keeps entries on both edges of the range', () => {
    const edges = [
      entry({ spentAt: new Date('2026-08-19T15:00:00Z') }),
      entry({ spentAt: new Date('2026-08-21T15:00:00Z') }),
    ]

    expect(entriesWithin(edges, range, SAO_PAULO)).toHaveLength(2)
  })

  it('drops what the one-day query margin brought in', () => {
    const outside = [
      entry({ spentAt: new Date('2026-08-18T15:00:00Z') }),
      entry({ spentAt: new Date('2026-08-22T15:00:00Z') }),
    ]

    expect(entriesWithin(outside, range, SAO_PAULO)).toHaveLength(0)
  })

  it('judges the edges in the reader time zone, not in UTC', () => {
    // 02:00Z on the 22nd is still the 21st in Sao Paulo, so it belongs.
    const late = [entry({ spentAt: new Date('2026-08-22T02:00:00Z') })]

    expect(entriesWithin(late, range, SAO_PAULO)).toHaveLength(1)
    expect(entriesWithin(late, range, 'UTC')).toHaveLength(0)
  })
})

describe('dayTotals', () => {
  it('is empty for no entries', () => {
    expect(dayTotals([], SAO_PAULO)).toEqual([])
  })

  it('groups by the calendar day of the reader time zone', () => {
    // 02:00Z on the 21st is 23:00 on the 20th in Sao Paulo.
    const entries = [entry({ spentAt: new Date('2026-08-21T02:00:00Z') })]

    expect(dayTotals(entries, SAO_PAULO)[0]?.date).toBe('2026-08-20')
    expect(dayTotals(entries, 'UTC')[0]?.date).toBe('2026-08-21')
  })

  it('can move an entry to the next day in a zone ahead of UTC', () => {
    const entries = [entry({ spentAt: new Date('2026-08-20T15:00:00Z') })]

    expect(dayTotals(entries, TOKYO)[0]?.date).toBe('2026-08-21')
  })

  it('lists days newest first', () => {
    const entries = [
      entry({ spentAt: new Date('2026-08-18T15:00:00Z') }),
      entry({ spentAt: new Date('2026-08-20T15:00:00Z') }),
      entry({ spentAt: new Date('2026-08-19T15:00:00Z') }),
    ]

    expect(dayTotals(entries, SAO_PAULO).map((day) => day.date)).toEqual([
      '2026-08-20',
      '2026-08-19',
      '2026-08-18',
    ])
  })

  it('totals a day from the seconds of its entries', () => {
    const entries = [entry({ seconds: 24_120 }), entry({ seconds: 2700 })]

    const [day] = dayTotals(entries, SAO_PAULO)

    expect(day?.seconds).toBe(26_820)
    expect(day?.hours).toBe(7.45)
    expect(day?.entryCount).toBe(2)
  })

  it('merges two entries on the same work item into one row', () => {
    const entries = [entry({ seconds: 2700 }), entry({ seconds: 24_120 })]

    const [day] = dayTotals(entries, SAO_PAULO)

    expect(day?.items).toHaveLength(1)
    expect(day?.items[0]?.seconds).toBe(26_820)
    expect(day?.items[0]?.entryCount).toBe(2)
  })

  it('keeps different work items apart', () => {
    const entries = [
      entry({ workItem: issue('invent-software/inventariofiscal#128') }),
      entry({ workItem: issue('invent-software/inventariofiscal#127') }),
    ]

    const [day] = dayTotals(entries, SAO_PAULO)

    expect(day?.items).toHaveLength(2)
  })

  it('lists the work item with the most time first', () => {
    const entries = [
      entry({ seconds: 1800, workItem: issue('invent-software/inventariofiscal#127') }),
      entry({ seconds: 24_120, workItem: issue('invent-software/inventariofiscal#128') }),
    ]

    const [day] = dayTotals(entries, SAO_PAULO)

    expect(day?.items[0]?.workItem?.reference).toBe('invent-software/inventariofiscal#128')
  })

  it('makes the day total the sum of its work items', () => {
    const entries = [
      entry({ seconds: 24_120, workItem: issue('invent-software/inventariofiscal#128') }),
      entry({ seconds: 2700, workItem: issue('invent-software/inventariofiscal#127') }),
    ]

    const [day] = dayTotals(entries, SAO_PAULO)
    const itemSeconds = (day?.items ?? []).reduce((total, item) => total + item.seconds, 0)

    expect(itemSeconds).toBe(day?.seconds)
  })

  it('counts time logged without a work item instead of dropping it', () => {
    const entries = [entry({ seconds: 3600, workItem: null })]

    const [day] = dayTotals(entries, SAO_PAULO)

    expect(day?.seconds).toBe(3600)
    expect(day?.items).toHaveLength(1)
    expect(day?.items[0]?.workItem).toBeNull()
  })

  it('groups unattributed time by project, so a reader knows where it went', () => {
    const entries = [
      entry({ project: FISCAL, seconds: 3600, workItem: null }),
      entry({ project: FISCAL, seconds: 1800, workItem: null }),
      entry({ project: WEB, seconds: 900, workItem: null }),
    ]

    const [day] = dayTotals(entries, SAO_PAULO)

    expect(day?.items).toHaveLength(2)
    expect(day?.items[0]?.seconds).toBe(5400)
    expect(day?.items[0]?.project?.fullPath).toBe(FISCAL.fullPath)
  })

  it('keeps attributed and unattributed time apart on the same day', () => {
    const entries = [entry({ seconds: 3600 }), entry({ seconds: 1800, workItem: null })]

    const [day] = dayTotals(entries, SAO_PAULO)

    expect(day?.items).toHaveLength(2)
    expect(day?.seconds).toBe(5400)
  })

  it('carries the project through, for two projects with the same name', () => {
    const entries = [entry({ project: WEB })]

    const [day] = dayTotals(entries, SAO_PAULO)

    expect(day?.items[0]?.project).toEqual(WEB)
  })
})

describe('an entry whose project could not be read', () => {
  it('counts towards its day like any other', () => {
    const entries = [entry({ project: null, seconds: 1800 }), entry({ seconds: 3600 })]

    const [day] = dayTotals(entries, SAO_PAULO)

    expect(day?.seconds).toBe(5400)
    expect(day?.entryCount).toBe(2)
  })

  it('counts towards a period total', () => {
    expect(periodTotal([entry({ project: null, seconds: 1800 })]).seconds).toBe(1800)
  })

  it('appears in the breakdown with no project rather than being omitted', () => {
    const entries = [entry({ project: null, seconds: 1800, workItem: null })]

    const [day] = dayTotals(entries, SAO_PAULO)

    expect(day?.items).toHaveLength(1)
    expect(day?.items[0]?.project).toBeNull()
    expect(day?.items[0]?.seconds).toBe(1800)
  })

  /**
   * The unattributed key falls back to the project path, so two entries with no
   * work item and no project have nothing left to tell them apart — and nothing
   * here knows whether they came from one project or two.
   */
  it('groups unattributed time with no project into one row', () => {
    const entries = [
      entry({ project: null, seconds: 1800, workItem: null }),
      entry({ project: null, seconds: 900, workItem: null }),
    ]

    const [day] = dayTotals(entries, SAO_PAULO)

    expect(day?.items).toHaveLength(1)
    expect(day?.items[0]?.seconds).toBe(2700)
  })

  it('stays apart from unattributed time in a project that could be read', () => {
    const entries = [
      entry({ project: null, seconds: 1800, workItem: null }),
      entry({ project: FISCAL, seconds: 900, workItem: null }),
    ]

    const [day] = dayTotals(entries, SAO_PAULO)

    expect(day?.items).toHaveLength(2)
  })

  it('still groups by work item when it has one', () => {
    const onItem = issue('invent-software/inventariofiscal#128')
    const entries = [
      entry({ project: null, seconds: 1800, workItem: onItem }),
      entry({ project: FISCAL, seconds: 900, workItem: onItem }),
    ]

    const [day] = dayTotals(entries, SAO_PAULO)

    expect(day?.items).toHaveLength(1)
    expect(day?.items[0]?.seconds).toBe(2700)
  })
})
