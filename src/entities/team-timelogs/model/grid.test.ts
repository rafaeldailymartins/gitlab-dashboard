import { describe, expect, it } from 'vitest'
import {
  ANA,
  BRUNO,
  CAMILA,
  EIGHT_BY_FIVE,
  entry,
  member,
} from '~tests/support/gitlab-team-timelogs'

import { isoDate } from '@/shared/lib/date'

import type { GridRequest, MemberWindow } from './grid'
import type { Person } from './types'

import { teamGrid } from './grid'

const MAY = { from: isoDate('2026-05-01'), to: isoDate('2026-05-31') }
const UTC = 'UTC'
const HOUR = 3600

function cellOn(grid: ReturnType<typeof teamGrid>, day: string, row = 0) {
  return grid.rows[row]?.cells.find((cell) => cell.key === day)
}

/** Everything read, today past the month's end: nothing pending, nothing future. */
function request(overrides: Partial<GridRequest> = {}): GridRequest {
  return {
    granularity: 'days',
    members: [window(ANA)],
    period: MAY,
    reference: EIGHT_BY_FIVE,
    timeZone: UTC,
    today: isoDate('2026-06-15'),
    ...overrides,
  }
}

/** One person's slice, read to the end of the month and resolved by the provider. */
function window(person: Person, overrides: Partial<MemberWindow> = {}): MemberWindow {
  return {
    declared: null,
    entries: [],
    identity: { kind: 'confirmed', person },
    loadedThrough: MAY.to,
    member: member(person),
    ...overrides,
  }
}

describe('teamGrid, cells', () => {
  it('sums two entries logged by one person on one day', () => {
    const grid = teamGrid(
      request({
        members: [
          window(ANA, {
            entries: [entry('2026-05-12T09:00:00Z', HOUR), entry('2026-05-12T14:00:00Z', 1800)],
          }),
        ],
      }),
    )

    expect(cellOn(grid, '2026-05-12')).toMatchObject({ entryCount: 2, hours: 1.5, seconds: 5400 })
  })

  it('keeps a day whose entries cancel out as a day that was accounted for', () => {
    const grid = teamGrid(
      request({
        members: [
          window(ANA, {
            entries: [entry('2026-05-12T09:00:00Z', HOUR), entry('2026-05-12T14:00:00Z', -HOUR)],
          }),
        ],
      }),
    )

    expect(cellOn(grid, '2026-05-12')).toMatchObject({ entryCount: 2, kind: 'logged', seconds: 0 })
  })

  it('separates a day with no entries from one whose entries cancelled out', () => {
    const grid = teamGrid(request())

    expect(cellOn(grid, '2026-05-12')).toMatchObject({ entryCount: 0, kind: 'unlogged' })
  })

  it('keeps each person’s entries to their own row', () => {
    const grid = teamGrid(
      request({
        members: [
          window(ANA, { entries: [entry('2026-05-12T09:00:00Z', HOUR)] }),
          window(BRUNO, { entries: [entry('2026-05-12T09:00:00Z', 7200)] }),
        ],
      }),
    )

    expect(cellOn(grid, '2026-05-12', 0)?.seconds).toBe(HOUR)
    expect(cellOn(grid, '2026-05-12', 1)?.seconds).toBe(7200)
  })

  it('reports the share of the reference, unclamped so over reads as over', () => {
    const grid = teamGrid(
      request({ members: [window(ANA, { entries: [entry('2026-05-12T09:00:00Z', 12 * HOUR)] })] }),
    )

    expect(cellOn(grid, '2026-05-12')?.share).toBe(1.5)
  })

  it('reports no share where the reference expects nothing', () => {
    // 2 May 2026 is a Saturday.
    expect(cellOn(teamGrid(request()), '2026-05-02')?.share).toBeNull()
  })
})

describe('teamGrid, cell kinds', () => {
  it('marks a working day with nothing logged', () => {
    expect(cellOn(teamGrid(request()), '2026-05-04')?.kind).toBe('unlogged')
  })

  it('marks a day the reference expects nothing of', () => {
    expect(cellOn(teamGrid(request()), '2026-05-02')?.kind).toBe('non-working')
  })

  it('marks a day later than today, rather than calling it unlogged', () => {
    const grid = teamGrid(request({ today: isoDate('2026-05-12') }))

    expect(cellOn(grid, '2026-05-13')?.kind).toBe('future')
    expect(cellOn(grid, '2026-05-12')?.kind).toBe('unlogged')
  })

  it('marks everything past one person’s own frontier as pending', () => {
    const grid = teamGrid(
      request({ members: [window(ANA, { loadedThrough: isoDate('2026-05-12') })] }),
    )

    expect(cellOn(grid, '2026-05-12')?.kind).toBe('unlogged')
    expect(cellOn(grid, '2026-05-13')?.kind).toBe('pending')
  })

  it('holds one person at pending while another is already final', () => {
    // Each person is their own connection, so a heavy logger still being read
    // must not mark a colleague’s finished month provisional.
    const grid = teamGrid(
      request({ members: [window(ANA), window(BRUNO, { loadedThrough: isoDate('2026-05-12') })] }),
    )

    expect(cellOn(grid, '2026-05-20', 0)?.kind).toBe('unlogged')
    expect(cellOn(grid, '2026-05-20', 1)?.kind).toBe('pending')
  })

  it('marks a column pending even when entries for it have already arrived', () => {
    const grid = teamGrid(
      request({
        members: [
          window(ANA, {
            entries: [entry('2026-05-20T09:00:00Z', HOUR)],
            loadedThrough: isoDate('2026-05-12'),
          }),
        ],
      }),
    )

    expect(cellOn(grid, '2026-05-20')?.kind).toBe('pending')
  })

  it('marks everything pending when nothing has been read', () => {
    const grid = teamGrid(request({ members: [window(ANA, { loadedThrough: null })] }))

    expect(grid.rows[0]?.cells.every((cell) => cell.kind === 'pending')).toBe(true)
  })

  it('marks every cell unknown for somebody the provider would not resolve', () => {
    const grid = teamGrid(request({ members: [window(ANA, { identity: { kind: 'unresolved' } })] }))

    expect(grid.rows[0]?.cells.every((cell) => cell.kind === 'unknown')).toBe(true)
  })

  it('marks a week column pending until its last day has been read', () => {
    const upToThursday = teamGrid(
      request({
        granularity: 'weeks',
        members: [window(ANA, { loadedThrough: isoDate('2026-05-07') })],
      }),
    )
    const upToSunday = teamGrid(
      request({
        granularity: 'weeks',
        members: [window(ANA, { loadedThrough: isoDate('2026-05-10') })],
      }),
    )

    expect(upToThursday.rows[0]?.cells[1]?.kind).toBe('pending')
    expect(upToSunday.rows[0]?.cells[1]?.kind).toBe('unlogged')
  })
})

describe('teamGrid, totals', () => {
  const grid = teamGrid(
    request({
      members: [
        window(ANA, {
          entries: [entry('2026-05-04T09:00:00Z', 24_120), entry('2026-05-05T09:00:00Z', 21_480)],
        }),
        window(BRUNO, { entries: [entry('2026-05-04T09:00:00Z', 12_060)] }),
        window(CAMILA),
      ],
    }),
  )

  it('agrees three ways, in seconds', () => {
    const rows = grid.rows.reduce((sum, row) => sum + row.total.seconds, 0)
    const columns = grid.columnTotals.reduce((sum, total) => sum + total.seconds, 0)

    expect(grid.grandTotal.seconds).toBe(57_660)
    expect(rows).toBe(grid.grandTotal.seconds)
    expect(columns).toBe(grid.grandTotal.seconds)
  })

  it('converts once rather than adding up rounded figures', () => {
    // 18 seconds is 0.005 h, which rounds up on its own. Three of them are
    // 0.015 h, which rounds to 0.02 — not to the 0.03 the displayed cells sum to.
    const drifting = teamGrid(
      request({
        members: [
          window(ANA, {
            entries: [1, 2, 3].map((day) => entry(`2026-05-0${String(day)}T09:00:00Z`, 18)),
          }),
        ],
      }),
    )
    const summedFromCells = drifting.rows[0]?.cells.reduce((sum, cell) => sum + cell.hours, 0)

    expect(drifting.grandTotal.seconds).toBe(54)
    expect(drifting.grandTotal.hours).toBe(0.02)
    expect(summedFromCells).toBeCloseTo(0.03, 10)
  })

  it('counts a person who logged nothing as a row with no hours', () => {
    const camila = grid.rows.find((row) => row.member.name === CAMILA.name)

    expect(camila?.total).toMatchObject({ entryCount: 0, hours: 0, seconds: 0 })
  })

  it('totals each column over everybody', () => {
    const monday = grid.columns.findIndex((column) => column.key === '2026-05-04')

    expect(grid.columnTotals[monday]?.seconds).toBe(36_180)
  })
})

describe('teamGrid, shape', () => {
  it('gives every row a cell for every column', () => {
    const grid = teamGrid(request({ members: [window(ANA), window(BRUNO)] }))

    for (const row of grid.rows) {
      expect(row.cells).toHaveLength(grid.columns.length)
    }
  })

  it('draws a row for every person the team names, in the order handed in', () => {
    const grid = teamGrid(request({ members: [window(CAMILA), window(ANA)] }))

    expect(grid.rows.map((row) => row.member.username)).toEqual([CAMILA.username, ANA.username])
  })

  it('still reports a column for every day when the team names nobody', () => {
    const empty = teamGrid(request({ members: [] }))

    expect(empty.rows).toEqual([])
    expect(empty.columnTotals).toHaveLength(31)
    expect(empty.columnTotals.every((total) => total.seconds === 0)).toBe(true)
    expect(empty.grandTotal.seconds).toBe(0)
  })

  it('bands day columns into weeks and leaves week columns unbanded', () => {
    expect(teamGrid(request()).weeks).toHaveLength(5)
    expect(teamGrid(request({ granularity: 'weeks' })).weeks).toEqual([])
  })

  it('places an entry on the day it falls on in the reader’s zone', () => {
    const entries = [entry('2026-05-13T01:00:00Z', HOUR)]
    const utc = teamGrid(request({ members: [window(ANA, { entries })] }))
    const saoPaulo = teamGrid(
      request({ members: [window(ANA, { entries })], timeZone: 'America/Sao_Paulo' }),
    )

    expect(cellOn(utc, '2026-05-13')?.seconds).toBe(HOUR)
    expect(cellOn(saoPaulo, '2026-05-12')?.seconds).toBe(HOUR)
  })
})

describe('teamGrid, the per-person shortfall', () => {
  const HOURS_46 = 167_400

  it('reports nothing when the provider was not asked about the person', () => {
    expect(teamGrid(request()).rows[0]?.shortfall).toBeNull()
  })

  it('reports no shortfall when everything the provider counted was shown', () => {
    const grid = teamGrid(
      request({
        members: [
          window(ANA, {
            declared: { entryCount: 1, seconds: HOURS_46 },
            entries: [entry('2026-05-04T09:00:00Z', HOURS_46)],
          }),
        ],
      }),
    )

    expect(grid.rows[0]?.shortfall).toMatchObject({ entryCount: 0, hours: 0, seconds: 0 })
  })

  it('reports the hours the provider counted but did not show', () => {
    const grid = teamGrid(
      request({
        members: [
          window(ANA, {
            declared: { entryCount: 3, seconds: HOURS_46 + 45_000 },
            entries: [entry('2026-05-04T09:00:00Z', HOURS_46)],
          }),
        ],
      }),
    )

    expect(grid.rows[0]?.shortfall).toMatchObject({ entryCount: 2, hours: 12.5, seconds: 45_000 })
  })

  it('distinguishes a person whose hours are all hidden from one who logged nothing', () => {
    const grid = teamGrid(
      request({
        members: [window(ANA, { declared: { entryCount: 4, seconds: HOURS_46 } }), window(BRUNO)],
      }),
    )

    expect(grid.rows[0]?.total.seconds).toBe(0)
    expect(grid.rows[0]?.shortfall?.seconds).toBe(HOURS_46)
    expect(grid.rows[1]?.shortfall).toBeNull()
  })

  it('does not call an hour logged in the padding days an hour withheld', () => {
    // The provider declares over the window it was asked about, which is the
    // month widened by a day at each end. This entry is inside that window and
    // outside the month, so it is drawn nowhere and withheld from nobody.
    const grid = teamGrid(
      request({
        members: [
          window(ANA, {
            declared: { entryCount: 1, seconds: HOURS_46 },
            entries: [entry('2026-04-30T09:00:00Z', HOURS_46)],
          }),
        ],
      }),
    )

    expect(grid.rows[0]?.total.seconds).toBe(0)
    expect(grid.rows[0]?.shortfall).toMatchObject({ entryCount: 0, hours: 0, seconds: 0 })
  })

  it('reports a negative shortfall rather than calling it nothing missing', () => {
    // A withheld correction: the visible figures are higher than the truth.
    const grid = teamGrid(
      request({
        members: [
          window(ANA, {
            declared: { entryCount: 2, seconds: HOURS_46 - 14_400 },
            entries: [entry('2026-05-04T09:00:00Z', HOURS_46)],
          }),
        ],
      }),
    )

    expect(grid.rows[0]?.shortfall).toMatchObject({ hours: -4, seconds: -14_400 })
  })
})
