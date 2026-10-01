import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import {
  ANA,
  BRUNO,
  CAMILA,
  DIEGO,
  EIGHT_BY_FIVE,
  entry,
  member,
} from '~tests/support/gitlab-team-timelogs'

import {
  type GridCell,
  type MemberIdentity,
  type Person,
  type TeamGrid,
  teamGrid,
  type TeamTimelogEntry,
} from '@/entities/team-timelogs'
import { isoDate } from '@/shared/lib/date'

/** One person's slice, as a scenario has described it so far. */
interface Slice {
  entries: TeamTimelogEntry[]
  identity: MemberIdentity
  loadedThrough: string
  person: Person
  settled: boolean
}

/** What a scenario has said so far, and the grid it describes. */
interface World {
  slices: Slice[]
  today: string
}

const feature = await loadFeature('features/domain/team-hours-matrix.feature')

const MAY = { from: isoDate('2026-05-01'), to: isoDate('2026-05-31') }

const PEOPLE: Record<string, Person> = { Ana: ANA, Bruno: BRUNO, Camila: CAMILA, Diego: DIEGO }

/**
 * The step text, declared once per line a scenario has of it.
 *
 * vitest-cucumber consumes one declaration per step, and two identical
 * declarations in one scenario collapse into one — which is why a scenario that
 * logs twice says "also" the second time.
 */
const ALSO_LOGGED = '{string} also logged {string}'
const LOGGED = '{string} logged {string}'
const NO_ENTRIES = 'the row for {string} holds no visible entries'
const ROWS = 'the matrix has rows for {string}'
const TEAM = 'a team of {string}'

const SECONDS_PER_HOUR = 3600
const SECONDS_PER_MINUTE = 60

function cellFor(state: World, name: string, date: string): GridCell | undefined {
  return rowFor(state, name)?.cells.find((cell) => cell.key === date)
}

/** Every name the matrix shows, in the order it shows them. */
function displayedNames(state: World): string[] {
  return gridOf(state).rows.map((row) => row.member.name)
}

/** The names a scenario's list refers to, resolved through the fixtures. */
function expectedNames(list: string): string[] {
  return namesFrom(list).map((name) => personOf(name).name)
}

function gridOf(state: World): TeamGrid {
  return teamGrid({
    granularity: 'days',
    members: state.slices.map((slice) => ({
      declared: null,
      entries: slice.entries,
      identity: slice.identity,
      loadedThrough: isoDate(slice.loadedThrough),
      member: member(slice.person),
      settled: slice.settled,
    })),
    period: MAY,
    reference: EIGHT_BY_FIVE,
    timeZone: 'UTC',
    today: isoDate(state.today),
  })
}

/**
 * Records one logged entry, said as `2h on 2026-05-04`.
 *
 * One placeholder rather than two, so a step stays inside the parameter
 * ceiling — and it reads as a sentence either way.
 *
 * Somebody the team does not name logs nowhere: the provider was asked about
 * the team and no one else, so an entry of theirs cannot exist in the answer.
 */
function log(state: World, name: string, what: string): void {
  const [duration = '', date = ''] = what.split(' on ')
  const slice = sliceFor(state, name)

  slice?.entries.push(entry(`${date}T09:00:00Z`, secondsOf(duration)))
}

function namesFrom(list: string): string[] {
  return list
    .split(/,| and /)
    .map((raw) => raw.trim())
    .filter((name) => name !== '')
}

function personOf(name: string): Person {
  const person = PEOPLE[name]

  if (!person) {
    throw new Error(`No fixture for ${name}`)
  }

  return person
}

function rowFor(state: World, name: string) {
  return gridOf(state).rows.find((row) => row.member.name === personOf(name).name)
}

/** `2h`, `1h30m`, `-2h` — enough to say a duration in a scenario and no more. */
function secondsOf(duration: string): number {
  const match = /^(-?)(\d+)h(?:(\d+)m)?$/u.exec(duration)

  if (!match) {
    throw new Error(`Not a duration: ${duration}`)
  }

  const [, sign, hours = '0', minutes = '0'] = match

  return (
    (sign === '-' ? -1 : 1) *
    (Number(hours) * SECONDS_PER_HOUR + Number(minutes) * SECONDS_PER_MINUTE)
  )
}

function sliceFor(state: World, name: string): Slice | undefined {
  return state.slices.find((slice) => slice.person.name === personOf(name).name)
}

/** The team a scenario names, everybody resolved and read to the month's end. */
function teamOf(list: string): Slice[] {
  return namesFrom(list).map((name) => {
    const person = personOf(name)

    return {
      entries: [],
      identity: { kind: 'confirmed', person },
      loadedThrough: MAY.to,
      person,
      settled: true,
    }
  })
}

/** The two sums the grand total has to agree with, in seconds. */
function totalsOf(grid: TeamGrid): { columns: number; rows: number } {
  return {
    columns: grid.columnTotals.reduce((sum, total) => sum + total.seconds, 0),
    rows: grid.rows.reduce((sum, row) => sum + row.total.seconds, 0),
  }
}

function world(): World {
  return { slices: [], today: '2026-06-15' }
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  Scenario('Somebody who logged nothing still has a row', ({ And, Given, Then }) => {
    const state = world()

    Given(TEAM, (_context, list: string) => {
      state.slices = teamOf(list)
    })

    And(LOGGED, (_context, name: string, what: string) => {
      log(state, name, what)
    })

    Then(ROWS, (_context, list: string) => {
      expect(displayedNames(state)).toEqual(expectedNames(list))
    })

    And(NO_ENTRIES, (_context, name: string) => {
      expect(rowFor(state, name)?.total.entryCount).toBe(0)
    })
  })

  Scenario(
    'Somebody who logged time but is not on the team gets no row',
    ({ And, Given, Then }) => {
      const state = world()

      Given(TEAM, (_context, list: string) => {
        state.slices = teamOf(list)
      })

      And(LOGGED, (_context, name: string, what: string) => {
        log(state, name, what)
      })

      Then(ROWS, (_context, list: string) => {
        expect(displayedNames(state)).toEqual(expectedNames(list))
      })
    },
  )

  Scenario('The rows are drawn in the order the team names them', ({ Given, Then }) => {
    const state = world()

    Given(TEAM, (_context, list: string) => {
      state.slices = teamOf(list)
    })

    Then('the matrix rows are in the order {string}', (_context, list: string) => {
      expect(displayedNames(state)).toEqual(expectedNames(list))
    })
  })

  Scenario('Two entries on the same day are one cell', ({ And, Given, Then }) => {
    const state = world()

    Given(TEAM, (_context, list: string) => {
      state.slices = teamOf(list)
    })

    And(LOGGED, (_context, name: string, what: string) => {
      log(state, name, what)
    })

    And(ALSO_LOGGED, (_context, name: string, what: string) => {
      log(state, name, what)
    })

    Then(
      'the cell for {string} on {string} reads {string} hours',
      (_context, name: string, date: string) => {
        expect(cellFor(state, name, date)?.hours).toBe(3.5)
      },
    )
  })

  Scenario('A day whose entries cancel out is not a day with none', ({ And, Given, Then }) => {
    const state = world()

    Given(TEAM, (_context, list: string) => {
      state.slices = teamOf(list)
    })

    And(LOGGED, (_context, name: string, what: string) => {
      log(state, name, what)
    })

    And(ALSO_LOGGED, (_context, name: string, what: string) => {
      log(state, name, what)
    })

    Then(
      'the cell for {string} on {string} reads {string} hours',
      (_context, name: string, date: string) => {
        expect(cellFor(state, name, date)?.hours).toBe(0)
      },
    )

    And(
      'the cell for {string} on {string} counts {string} entries',
      (_context, name: string, date: string) => {
        expect(cellFor(state, name, date)?.entryCount).toBe(2)
      },
    )
  })

  ScenarioOutline(
    'Each kind of empty cell says which kind it is',
    ({ And, Given, Then }, variables) => {
      const example = variables as { date: string; kind: string; read: string; today: string }
      const state = world()

      Given(TEAM, (_context, list: string) => {
        state.slices = teamOf(list)
      })

      And("Ana's month has been read up to <read>", () => {
        readUpTo(state, 'Ana', example.read)
      })

      And('today is <today>', () => {
        state.today = example.today
      })

      Then('the cell for Ana on <date> is "<kind>"', () => {
        expect(cellFor(state, 'Ana', example.date)?.kind).toBe(example.kind)
      })
    },
  )

  Scenario(
    'A stored member the provider does not recognise says nothing about any day',
    ({ And, Given, Then }) => {
      const state = world()

      Given(TEAM, (_context, list: string) => {
        state.slices = teamOf(list)
      })

      And('GitLab does not recognise {string}', (_context, name: string) => {
        forget(state, name)
      })

      Then('every cell for Ana is "unknown"', () => {
        expect(everyCellIs(state, 'Ana', 'unknown')).toBe(true)
      })

      And(NO_ENTRIES, (_context, name: string) => {
        expect(rowFor(state, name)?.total.entryCount).toBe(0)
      })
    },
  )

  Scenario(
    'One person still being read does not hold up another who is finished',
    ({ And, Given, Then }) => {
      const state = world()

      Given(TEAM, (_context, list: string) => {
        state.slices = teamOf(list)
      })

      And("Ana's month has been read up to 2026-05-31", () => {
        readUpTo(state, 'Ana', '2026-05-31')
      })

      And("Bruno's month has been read up to 2026-05-12", () => {
        readUpTo(state, 'Bruno', '2026-05-12')
      })

      Then('the cell for Ana on 2026-05-20 is "unlogged"', () => {
        expect(cellFor(state, 'Ana', '2026-05-20')?.kind).toBe('unlogged')
      })

      And('the cell for Bruno on 2026-05-20 is "pending"', () => {
        expect(cellFor(state, 'Bruno', '2026-05-20')?.kind).toBe('pending')
      })

      And("Ana's row total is final", () => {
        expect(rowFor(state, 'Ana')?.settled).toBe(true)
      })

      And("Bruno's row total is still pending", () => {
        expect(rowFor(state, 'Bruno')?.settled).toBe(false)
      })
    },
  )

  Scenario('The grand total agrees with the rows and with the columns', ({ And, Given, Then }) => {
    const state = world()

    Given(TEAM, (_context, list: string) => {
      state.slices = teamOf(list)
    })

    And(LOGGED, (_context, name: string, what: string) => {
      log(state, name, what)
    })

    And(ALSO_LOGGED, (_context, name: string, what: string) => {
      log(state, name, what)
    })

    Then('the grand total equals the sum of the rows', () => {
      const grid = gridOf(state)

      expect(totalsOf(grid).rows).toBe(grid.grandTotal.seconds)
    })

    And('the grand total equals the sum of the columns', () => {
      const grid = gridOf(state)

      expect(totalsOf(grid).columns).toBe(grid.grandTotal.seconds)
    })
  })

  Scenario('A month that starts mid-week opens with a short band', ({ And, Given, Then }) => {
    const state = world()

    Given(TEAM, (_context, list: string) => {
      state.slices = teamOf(list)
    })

    Then('the first week band spans {string} columns', (_context, count: string) => {
      expect(gridOf(state).weeks.at(0)?.columnCount).toBe(Number(count))
    })

    And(
      'the first week band is ISO week {string} of {string}',
      (_context, week: string, year: string) => {
        expect(gridOf(state).weeks.at(0)).toMatchObject({
          isoWeek: Number(week),
          isoWeekYear: Number(year),
        })
      },
    )
  })
})

/** Whether one row says the same thing about every day of the month. */
function everyCellIs(state: World, name: string, kind: string): boolean {
  const cells = rowFor(state, name)?.cells ?? []

  return cells.length > 0 && cells.every((cell) => cell.kind === kind)
}

/** What a stored member the provider will not resolve looks like. */
function forget(state: World, name: string): void {
  const slice = sliceFor(state, name)

  if (slice) {
    slice.identity = { kind: 'unresolved' }
  }
}

/** How far one person's own reading has got. Each of them has their own. */
function readUpTo(state: World, name: string, date: string): void {
  const slice = sliceFor(state, name)

  if (slice) {
    slice.loadedThrough = date
    // Read to the month's last day is a finished read in this table, which has
    // no way to say "an entry on the padding day, and a cursor still left" —
    // the one case where the two part, and the grid's own tests hold that one.
    slice.settled = date === MAY.to
  }
}
