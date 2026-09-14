import { describe, expect, it } from 'vitest'

import { isoDate } from '@/shared/lib/date'

import type { GridColumn } from './columns'
import type { GroupTimelogEntry, Person } from './types'

import { entriesWithin, readerWindow, spanColumns } from './window'

const SAO_PAULO = 'America/Sao_Paulo'
const TOKYO = 'Asia/Tokyo'
const UTC = 'UTC'

const ANA: Person = {
  id: 'gid://gitlab/User/1',
  name: 'Ana Carolina',
  username: 'ana',
  webUrl: 'https://gitlab.com/ana',
}

function entryAt(instant: string): GroupTimelogEntry {
  return {
    id: `gid://gitlab/Timelog/${instant}`,
    person: ANA,
    seconds: 3600,
    spentAt: new Date(instant),
  }
}

describe('readerWindow', () => {
  it('reports the reader’s month as the period to cut to', () => {
    expect(readerWindow(isoDate('2026-05-12')).period).toEqual({
      from: '2026-05-01',
      to: '2026-05-31',
    })
  })

  it('widens the asked-for window by one whole UTC day at each end', () => {
    const window = readerWindow(isoDate('2026-05-12'))

    expect(window.from).toBe('2026-04-30T00:00:00.000Z')
    expect(window.to).toBe('2026-06-01T23:59:59.999Z')
  })

  it('carries an explicit UTC offset on both ends, so no default zone can enter', () => {
    const window = readerWindow(isoDate('2026-05-12'))

    expect(window.from.endsWith('Z')).toBe(true)
    expect(window.to.endsWith('Z')).toBe(true)
  })

  it('always produces a start before its end, which the provider requires', () => {
    for (const month of ['2026-01-15', '2026-02-01', '2026-12-31', '2024-02-29']) {
      const window = readerWindow(isoDate(month))

      expect(window.from < window.to).toBe(true)
    }
  })

  it('crosses a year boundary at both ends', () => {
    const january = readerWindow(isoDate('2026-01-20'))
    const december = readerWindow(isoDate('2026-12-05'))

    expect(january.from).toBe('2025-12-31T00:00:00.000Z')
    expect(december.to).toBe('2027-01-01T23:59:59.999Z')
  })

  it('covers the first local day of the month in the furthest zone ahead of UTC', () => {
    // Pacific/Kiritimati is UTC+14, so 1 May there begins 2026-04-30T10:00Z.
    expect(readerWindow(isoDate('2026-05-12')).from <= '2026-04-30T10:00:00.000Z').toBe(true)
  })

  it('covers the last local day of the month in the furthest zone behind UTC', () => {
    // Etc/GMT+12 is UTC-12, so 31 May there ends 2026-06-01T11:59:59.999Z.
    expect(readerWindow(isoDate('2026-05-12')).to >= '2026-06-01T11:59:59.999Z').toBe(true)
  })
})

describe('entriesWithin', () => {
  const { period } = readerWindow(isoDate('2026-05-12'))

  it('keeps an entry whose day falls inside the range', () => {
    expect(entriesWithin([entryAt('2026-05-12T15:00:00Z')], period, SAO_PAULO)).toHaveLength(1)
  })

  it('keeps an entry that is in the month in the reader’s zone but not in UTC', () => {
    // 03:00Z on 1 May is still 30 April in Sao Paulo, and 1 May in UTC.
    const late = entryAt('2026-05-01T01:00:00Z')

    expect(entriesWithin([late], period, UTC)).toHaveLength(1)
    expect(entriesWithin([late], period, SAO_PAULO)).toHaveLength(0)
  })

  it('keeps an entry that is in the month ahead of UTC but not in UTC', () => {
    // 15:00Z on 30 April is already 1 May in Tokyo.
    const early = entryAt('2026-04-30T15:00:00Z')

    expect(entriesWithin([early], period, TOKYO)).toHaveLength(1)
    expect(entriesWithin([early], period, UTC)).toHaveLength(0)
  })

  it('drops the padding days the widened window brought back', () => {
    const padding = [entryAt('2026-04-30T09:00:00Z'), entryAt('2026-06-01T20:00:00Z')]

    expect(entriesWithin(padding, period, UTC)).toEqual([])
  })

  it('includes both edges of the range', () => {
    const edges = [entryAt('2026-05-01T12:00:00Z'), entryAt('2026-05-31T12:00:00Z')]

    expect(entriesWithin(edges, period, UTC)).toHaveLength(2)
  })

  it('returns nothing for no entries', () => {
    expect(entriesWithin([], period, UTC)).toEqual([])
  })
})

describe('spanColumns', () => {
  const DAY: GridColumn = {
    from: isoDate('2026-05-12'),
    key: '2026-05-12',
    referenceHours: 8,
    to: isoDate('2026-05-12'),
  }

  const WEEK: GridColumn = {
    from: isoDate('2026-05-11'),
    key: '2026-W20',
    referenceHours: 40,
    to: isoDate('2026-05-17'),
  }

  it('keeps each column’s own key, which is what the answer is read back by', () => {
    expect(spanColumns([DAY, WEEK], UTC).map((span) => span.key)).toEqual([
      '2026-05-12',
      '2026-W20',
    ])
  })

  it('opens a day column at that day’s first instant in the reader’s zone', () => {
    expect(spanColumns([DAY], SAO_PAULO)[0]?.from).toBe('2026-05-12T03:00:00.000Z')
  })

  it('closes it a microsecond before the next day opens', () => {
    expect(spanColumns([DAY], SAO_PAULO)[0]?.to).toBe('2026-05-13T02:59:59.999999Z')
  })

  it('spans a week column from its first day to its last', () => {
    expect(spanColumns([WEEK], UTC)[0]).toMatchObject({
      from: '2026-05-11T00:00:00.000Z',
      to: '2026-05-17T23:59:59.999999Z',
    })
  })

  it('asks for nothing when there are no columns', () => {
    expect(spanColumns([], UTC)).toEqual([])
  })
})
