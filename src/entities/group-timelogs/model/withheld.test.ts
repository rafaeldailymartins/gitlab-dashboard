import { describe, expect, it } from 'vitest'
import { ANA, entry, member } from '~tests/support/gitlab-group-timelogs'

import { isoDate } from '@/shared/lib/date'

import type { GridRequest, TeamGrid } from './grid'
import type { DeclaredTotals } from './ports'
import type { WithheldDeclaration } from './withheld'

import { teamGrid } from './grid'
import { REFERENCE_SCHEDULE } from './types'
import { unplacedOf, withWithheld } from './withheld'

const NOTHING: DeclaredTotals = { entryCount: 0, seconds: 0 }
const MAY = { from: isoDate('2026-05-01'), to: isoDate('2026-05-31') }
const HOUR = 3600
const LOGGED_ON = '2026-05-04'

/** What the provider declares when it showed the reader everything. */
const NOTHING_WITHHELD: DeclaredTotals = { entryCount: 1, seconds: 6 * HOUR }
const WITHHELD_ON = '2026-05-12'

function cellOn(grid: TeamGrid, day: string) {
  return rowOf(grid)?.cells.find((cell) => cell.key === day)
}

function columnTotalOn(grid: TeamGrid, day: string) {
  const at = grid.columns.findIndex((column) => column.key === day)

  return at === -1 ? undefined : grid.columnTotals[at]
}

function declarationsFor(declaration: WithheldDeclaration) {
  return new Map([[ANA.username, declaration]])
}

/**
 * A declaration covering every day of May.
 *
 * Built from the grid's own column keys so the spans tile the period by
 * construction — which is what the rules under test check, and what the
 * `broken` argument then breaks on purpose.
 */
function declare(
  grid: TeamGrid,
  withheld: Record<string, DeclaredTotals> = {},
): WithheldDeclaration {
  const byColumn = new Map<string, DeclaredTotals>()

  for (const column of grid.columns) {
    byColumn.set(column.key, plus(shownIn(grid, column.key), withheld[column.key] ?? NOTHING))
  }

  return { byColumn, period: totalOf(byColumn) }
}

/** Six hours on 4 May, and whatever the provider was asked to declare. */
function gridOf(declared: DeclaredTotals = NOTHING_WITHHELD): TeamGrid {
  const request: GridRequest = {
    entries: [entry(ANA, `${LOGGED_ON}T09:00:00Z`, 6 * HOUR)],
    granularity: 'days',
    loadedThrough: MAY.to,
    period: MAY,
    perPerson: new Map([[ANA.username, declared]]),
    reference: REFERENCE_SCHEDULE,
    roster: [member(ANA)],
    timeZone: 'UTC',
    today: isoDate('2026-06-15'),
  }

  return teamGrid(request)
}

function plus(left: DeclaredTotals, right: DeclaredTotals): DeclaredTotals {
  return {
    entryCount: left.entryCount + right.entryCount,
    seconds: left.seconds + right.seconds,
  }
}

function rowOf(grid: TeamGrid) {
  return grid.rows[0]
}

/** What the grid drew in one column, as a declaration to add to. */
function shownIn(grid: TeamGrid, key: string): DeclaredTotals {
  const cell = rowOf(grid)?.cells.find((one) => one.key === key)

  return { entryCount: cell?.entryCount ?? 0, seconds: cell?.seconds ?? 0 }
}

/**
 * A declaration with one empty column left out of it.
 *
 * The provider can leave a column out of its answer, and a column the reader
 * logged nothing in passes the check that no column declares less than was
 * shown — zero is not less than zero. So the placement has to handle a column
 * with no declaration rather than assume every one of them has one.
 */
function skipping(grid: TeamGrid) {
  const byColumn = new Map(declare(grid).byColumn)

  byColumn.delete('2026-05-20')

  return declarationsFor({ byColumn, period: totalOf(byColumn) })
}

function totalOf(byColumn: ReadonlyMap<string, DeclaredTotals>): DeclaredTotals {
  let entryCount = 0
  let seconds = 0

  for (const column of byColumn.values()) {
    entryCount += column.entryCount
    seconds += column.seconds
  }

  return { entryCount, seconds }
}

describe('withWithheld', () => {
  it('adds the withheld hours into the column that declared them', () => {
    const grid = gridOf({ entryCount: 2, seconds: 9 * HOUR })
    const declaration = declare(grid, { [WITHHELD_ON]: { entryCount: 1, seconds: 3 * HOUR } })

    const placed = withWithheld(grid, declarationsFor(declaration))

    expect(cellOn(placed, WITHHELD_ON)?.seconds).toBe(3 * HOUR)
  })

  it('calls a day the provider counted entries on a day that was logged', () => {
    const grid = gridOf({ entryCount: 2, seconds: 9 * HOUR })
    const declaration = declare(grid, { [WITHHELD_ON]: { entryCount: 1, seconds: 3 * HOUR } })

    const placed = withWithheld(grid, declarationsFor(declaration))

    expect(cellOn(placed, WITHHELD_ON)?.kind).toBe('logged')
  })

  it('redraws the bar against the figure it now shows', () => {
    // The bar is the one mark that could disagree with the number beside it.
    const grid = gridOf({ entryCount: 2, seconds: 9 * HOUR })
    const declaration = declare(grid, { [WITHHELD_ON]: { entryCount: 1, seconds: 4 * HOUR } })

    const placed = withWithheld(grid, declarationsFor(declaration))

    expect(cellOn(placed, WITHHELD_ON)?.share).toBe(0.5)
  })

  it('leaves every other column alone', () => {
    const grid = gridOf({ entryCount: 2, seconds: 9 * HOUR })
    const declaration = declare(grid, { [WITHHELD_ON]: { entryCount: 1, seconds: 3 * HOUR } })

    const placed = withWithheld(grid, declarationsFor(declaration))

    expect(cellOn(placed, LOGGED_ON)?.seconds).toBe(6 * HOUR)
    expect(cellOn(placed, '2026-05-20')?.seconds).toBe(0)
  })

  it('rebuilds every total from the summed cells', () => {
    const grid = gridOf({ entryCount: 2, seconds: 9 * HOUR })
    const declaration = declare(grid, { [WITHHELD_ON]: { entryCount: 1, seconds: 3 * HOUR } })

    const placed = withWithheld(grid, declarationsFor(declaration))

    // A screen whose parts add up is worth more than the hours themselves: the
    // row total, the column totals and the corner all move together or none do.
    expect(rowOf(placed)?.total.seconds).toBe(9 * HOUR)
    expect(placed.grandTotal.seconds).toBe(9 * HOUR)
    expect(columnTotalOn(placed, WITHHELD_ON)?.seconds).toBe(3 * HOUR)
  })

  it('reports how much of the shortfall now has a column', () => {
    const grid = gridOf({ entryCount: 2, seconds: 9 * HOUR })
    const declaration = declare(grid, { [WITHHELD_ON]: { entryCount: 1, seconds: 3 * HOUR } })

    const placed = withWithheld(grid, declarationsFor(declaration))

    expect(rowOf(placed)?.placed).toMatchObject({ entryCount: 1, hours: 3, seconds: 3 * HOUR })
  })

  it('keeps a difference that runs the other way signed', () => {
    // A withheld correction: the provider counts fewer hours here than the
    // entries it handed over add up to.
    const grid = gridOf({ entryCount: 1, seconds: 4 * HOUR })
    const byColumn = declare(grid).byColumn
    const corrected = new Map(byColumn)

    corrected.set(LOGGED_ON, { entryCount: 1, seconds: 4 * HOUR })

    const placed = withWithheld(
      grid,
      declarationsFor({ byColumn: corrected, period: totalOf(corrected) }),
    )

    // The provider counts fewer hours here than the entries it handed over.
    expect(cellOn(placed, LOGGED_ON)?.seconds).toBe(4 * HOUR)
  })

  it('leaves a row nobody was asked about untouched', () => {
    const grid = gridOf()

    const placed = withWithheld(grid, new Map())

    expect(rowOf(placed)?.placed).toBeNull()
    expect(cellOn(placed, LOGGED_ON)?.seconds).toBe(6 * HOUR)
  })

  it('refuses a declaration whose columns do not add up to its period', () => {
    // What overlapping spans look like: every entry counted twice, so the
    // columns come in higher than the period they are supposed to tile.
    const grid = gridOf({ entryCount: 2, seconds: 9 * HOUR })
    const declaration = declare(grid)

    const placed = withWithheld(
      grid,
      declarationsFor({ ...declaration, period: { entryCount: 99, seconds: 9 * HOUR } }),
    )

    expect(rowOf(placed)?.placed).toBeNull()
  })

  it('refuses a declaration missing a column the grid draws', () => {
    const grid = gridOf({ entryCount: 2, seconds: 9 * HOUR })
    const byColumn = new Map(declare(grid).byColumn)

    byColumn.delete(LOGGED_ON)

    const placed = withWithheld(grid, declarationsFor({ byColumn, period: totalOf(byColumn) }))

    expect(rowOf(placed)?.placed).toBeNull()
  })

  it('refuses a column that declares fewer entries than were shown in it', () => {
    const grid = gridOf({ entryCount: 2, seconds: 9 * HOUR })
    const byColumn = new Map(declare(grid).byColumn)

    byColumn.set(LOGGED_ON, { entryCount: 0, seconds: 0 })

    const placed = withWithheld(grid, declarationsFor({ byColumn, period: totalOf(byColumn) }))

    expect(rowOf(placed)?.placed).toBeNull()
  })

  it('refuses a period that declares less than the row already draws', () => {
    // What an unresolvable username answers: a count of zero, which is
    // otherwise indistinguishable from a month with nothing withheld in it.
    const grid = gridOf({ entryCount: 1, seconds: 6 * HOUR })
    const byColumn = new Map<string, DeclaredTotals>()

    for (const column of grid.columns) {
      byColumn.set(column.key, { entryCount: 0, seconds: 0 })
    }

    const placed = withWithheld(
      grid,
      declarationsFor({ byColumn, period: { entryCount: 0, seconds: 0 } }),
    )

    expect(rowOf(placed)?.placed).toBeNull()
  })
})

describe('unplacedOf', () => {
  it('says nothing about a row the provider was never asked about', () => {
    const grid = teamGrid({
      entries: [],
      granularity: 'days',
      loadedThrough: MAY.to,
      period: MAY,
      perPerson: new Map(),
      reference: REFERENCE_SCHEDULE,
      roster: [member(ANA)],
      timeZone: 'UTC',
      today: isoDate('2026-06-15'),
    })

    expect(unplacedOf(grid.rows[0] ?? never())).toBeNull()
  })

  it('is the whole shortfall while nothing has been placed', () => {
    const grid = gridOf({ entryCount: 2, seconds: 9 * HOUR })

    expect(unplacedOf(rowOf(grid) ?? never())).toMatchObject({ entryCount: 1, seconds: 3 * HOUR })
  })

  it('is nothing once every withheld entry has a column', () => {
    const grid = gridOf({ entryCount: 2, seconds: 9 * HOUR })
    const declaration = declare(grid, { [WITHHELD_ON]: { entryCount: 1, seconds: 3 * HOUR } })
    const placed = withWithheld(grid, declarationsFor(declaration))

    expect(unplacedOf(rowOf(placed) ?? never())).toMatchObject({ entryCount: 0, seconds: 0 })
  })

  it('is what the columns could not account for', () => {
    // The shortfall covers the widened window and the columns cover the month,
    // so an entry withheld on a padding day is in the first and in neither of
    // the second. The row says so rather than the screen rounding it away.
    const grid = gridOf({ entryCount: 3, seconds: 12 * HOUR })
    const declaration = declare(grid, { [WITHHELD_ON]: { entryCount: 1, seconds: 3 * HOUR } })
    const placed = withWithheld(grid, declarationsFor(declaration))

    expect(unplacedOf(rowOf(placed) ?? never())).toMatchObject({
      entryCount: 1,
      seconds: 3 * HOUR,
    })
  })
})

/** A row the fixtures guarantee exists; narrowing it in every test is noise. */
function never(): never {
  throw new Error('the fixture always builds a row')
}

describe('a declaration that skips a column nothing was logged in', () => {
  it('accepts it, because nothing was shown in that column either', () => {
    const grid = gridOf()

    expect(rowOf(withWithheld(grid, skipping(grid)))?.placed).not.toBeNull()
  })

  it('places nothing in the column it skipped', () => {
    const grid = gridOf()

    expect(cellOn(withWithheld(grid, skipping(grid)), '2026-05-20')?.seconds).toBe(0)
  })

  it('leaves it out of the total it reports', () => {
    const grid = gridOf()

    expect(rowOf(withWithheld(grid, skipping(grid)))?.placed).toMatchObject({
      entryCount: 0,
      seconds: 0,
    })
  })
})
