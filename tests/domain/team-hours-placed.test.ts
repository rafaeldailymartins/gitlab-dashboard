import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { ANA, entry, member } from '~tests/support/gitlab-team-timelogs'

import type {
  DeclaredTotals,
  GridRow,
  TeamGrid,
  TeamTimelogEntry,
  WithheldDeclaration,
} from '@/entities/team-timelogs'

import { REFERENCE_SCHEDULE, teamGrid, unplacedOf, withWithheld } from '@/entities/team-timelogs'
import { isoDate } from '@/shared/lib/date'

const feature = await loadFeature('features/domain/team-hours-placed.feature')

const MAY = { from: isoDate('2026-05-01'), to: isoDate('2026-05-31') }
const HOUR = 3600
const FOURTH = '2026-05-04'
const TWELFTH = '2026-05-12'

/** What one scenario builds before it asks for a grid. */
interface State {
  declared: Map<string, DeclaredTotals>
  entries: TeamTimelogEntry[]
  /** Overrides the period the columns are checked against, to break the tiling. */
  period: DeclaredTotals | null
}

function blank(): State {
  return { declared: new Map(), entries: [], period: null }
}

function cellOn(grid: TeamGrid, day: string) {
  return rowOf(grid)?.cells.find((cell) => cell.key === day)
}

function declarationOf(state: State, grid: TeamGrid): WithheldDeclaration {
  const byColumn = new Map<string, DeclaredTotals>()
  let entryCount = 0
  let seconds = 0

  for (const column of grid.columns) {
    const declared = state.declared.get(column.key) ?? { entryCount: 0, seconds: 0 }

    byColumn.set(column.key, declared)
    entryCount += declared.entryCount
    seconds += declared.seconds
  }

  return { byColumn, period: state.period ?? { entryCount, seconds } }
}

function hoursOf(duration: string): number {
  return Number(duration.replace('h', ''))
}

/** The grid, with whatever the provider declared placed on it. */
function placedGrid(state: State): TeamGrid {
  const grid = teamGrid({
    granularity: 'days',
    members: [
      {
        declared: totalDeclared(state),
        entries: state.entries,
        identity: { kind: 'confirmed', person: ANA },
        loadedThrough: MAY.to,
        member: member(ANA),
      },
    ],
    period: MAY,
    reference: REFERENCE_SCHEDULE,
    timeZone: 'UTC',
    today: isoDate('2026-06-15'),
  })

  return withWithheld(grid, new Map([[ANA.id, declarationOf(state, grid)]]))
}

function rowOf(grid: TeamGrid): GridRow | undefined {
  return grid.rows[0]
}

/**
 * What the per-person probe would have said, over the same days.
 *
 * The same provider answering about the same month, so when a scenario states
 * a period the columns cannot account for, this says the same thing: the row
 * knows an entry is missing, and the placement is what fails to find it.
 */
function totalDeclared(state: State): DeclaredTotals {
  if (state.period) {
    return state.period
  }

  let entryCount = 0
  let seconds = 0

  for (const declared of state.declared.values()) {
    entryCount += declared.entryCount
    seconds += declared.seconds
  }

  return { entryCount, seconds }
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('Withheld hours land on the day the provider counted them', ({ And, Given, Then }) => {
    const state = blank()

    Given(
      '{string} was shown {string} on the 4th and nothing on the 12th',
      (_context, _name: string, shown: string) => {
        state.entries.push(entry(`${FOURTH}T09:00:00Z`, hoursOf(shown) * HOUR))
      },
    )

    And(
      'the provider declares {string} on the 4th and {string} on the 12th',
      (_context, fourth: string, twelfth: string) => {
        state.declared.set(FOURTH, { entryCount: 1, seconds: hoursOf(fourth) * HOUR })
        state.declared.set(TWELFTH, { entryCount: 1, seconds: hoursOf(twelfth) * HOUR })
      },
    )

    Then('the cell for the 12th reads {string} hours', (_context, hours: string) => {
      expect(cellOn(placedGrid(state), TWELFTH)?.hours).toBe(Number(hours))
    })

    And('the row records {string} hours placed', (_context, hours: string) => {
      expect(rowOf(placedGrid(state))?.placed?.hours).toBe(Number(hours))
    })

    And('the cell for the 4th is unchanged', () => {
      expect(cellOn(placedGrid(state), FOURTH)?.hours).toBe(6)
    })
  })

  Scenario('Every total is rebuilt from the figures shown', ({ And, Given, Then }) => {
    const state = blank()

    Given(
      '{string} was shown {string} on the 4th and nothing on the 12th',
      (_context, _name: string, shown: string) => {
        state.entries.push(entry(`${FOURTH}T09:00:00Z`, hoursOf(shown) * HOUR))
      },
    )

    And(
      'the provider declares {string} on the 4th and {string} on the 12th',
      (_context, fourth: string, twelfth: string) => {
        state.declared.set(FOURTH, { entryCount: 1, seconds: hoursOf(fourth) * HOUR })
        state.declared.set(TWELFTH, { entryCount: 1, seconds: hoursOf(twelfth) * HOUR })
      },
    )

    Then('the row totals {string} hours', (_context, hours: string) => {
      expect(rowOf(placedGrid(state))?.total.hours).toBe(Number(hours))
    })

    And('the grand total equals the sum of the rows', () => {
      const grid = placedGrid(state)

      expect(grid.grandTotal.seconds).toBe(rowSecondsOf(grid))
    })
  })

  Scenario('Spans that do not tile the period are refused', ({ And, Given, Then }) => {
    const state = blank()

    Given(
      '{string} was shown {string} on the 4th and nothing on the 12th',
      (_context, _name: string, shown: string) => {
        state.entries.push(entry(`${FOURTH}T09:00:00Z`, hoursOf(shown) * HOUR))
      },
    )

    And('the provider declares a period holding more entries than its days do', () => {
      state.declared.set(FOURTH, { entryCount: 1, seconds: 6 * HOUR })
      // What overlapping spans look like from here: the period knows about an
      // entry that none of the columns accounted for.
      state.period = { entryCount: 2, seconds: 9 * HOUR }
    })

    Then('nothing is placed on any day', () => {
      expect(placedAnywhere(placedGrid(state))).toBe(false)
    })

    And('the row still reports what is missing without saying where', () => {
      expect(rowOf(placedGrid(state))?.placed).toBeNull()
      expect(unplacedOf(rowOf(placedGrid(state)) ?? missing())?.entryCount).not.toBe(0)
    })
  })

  Scenario('A day the provider counted and showed nothing of', ({ And, Given, Then }) => {
    const state = blank()

    Given('{string} was shown nothing all month', () => {
      state.entries = []
    })

    And('the provider declares {string} on the 12th', (_context, twelfth: string) => {
      state.declared.set(TWELFTH, { entryCount: 1, seconds: hoursOf(twelfth) * HOUR })
    })

    Then('the cell for the 12th reads {string} hours', (_context, hours: string) => {
      expect(cellOn(placedGrid(state), TWELFTH)?.hours).toBe(Number(hours))
    })

    And('the row records {string} hours placed', (_context, hours: string) => {
      expect(rowOf(placedGrid(state))?.placed?.hours).toBe(Number(hours))
    })
  })
})

/** The fixtures always build a row; narrowing it in every step is noise. */
function missing(): never {
  throw new Error('the fixture always builds a row')
}

/** Whether anything was placed on the first row at all. */
function placedAnywhere(grid: TeamGrid): boolean {
  return rowOf(grid)?.placed !== null
}

/** Every row total added up, for checking the corner against them. */
function rowSecondsOf(grid: TeamGrid): number {
  return grid.rows.reduce((sum, row) => sum + row.total.seconds, 0)
}
