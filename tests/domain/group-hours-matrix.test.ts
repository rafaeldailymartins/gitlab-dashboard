import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { ANA, BRUNO, CAMILA, DIEGO, entry, member } from '~tests/support/gitlab-group-timelogs'

import {
  type GridCell,
  type GroupTimelogEntry,
  type Person,
  REFERENCE_SCHEDULE,
  type RosterMember,
  teamGrid,
  type TeamGrid,
} from '@/entities/group-timelogs'
import { isoDate } from '@/shared/lib/date'

/** What a scenario has said so far, and the grid it describes. */
interface World {
  entries: GroupTimelogEntry[]
  loadedThrough: string
  roster: RosterMember[]
  today: string
}

const feature = await loadFeature('features/domain/group-hours-matrix.feature')

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
const MEMBERS = 'a group whose members are {string}'
const ROWS = 'the matrix has rows for {string}'

const SECONDS_PER_HOUR = 3600
const SECONDS_PER_MINUTE = 60

function cellFor(state: World, name: string, date: string): GridCell | undefined {
  return rowFor(state, name)?.cells.find((cell) => cell.key === date)
}

/** Every name the matrix would show, in the order it would show them. */
function displayedNames(state: World): string[] {
  return gridOf(state).rows.map((row) => row.person.name)
}

/** The names a scenario's list refers to, resolved through the fixtures. */
function expectedNames(list: string): string[] {
  return namesFrom(list).map((name) => personOf(name).name)
}

function gridOf(state: World): TeamGrid {
  return teamGrid({
    entries: state.entries,
    granularity: 'days',
    loadedThrough: isoDate(state.loadedThrough),
    period: MAY,
    perPerson: new Map(),
    reference: REFERENCE_SCHEDULE,
    roster: state.roster,
    timeZone: 'UTC',
    today: isoDate(state.today),
  })
}

/**
 * Records one logged entry, said as `2h on 2026-05-04`.
 *
 * One placeholder rather than two, so a step stays inside the parameter
 * ceiling — and it reads as a sentence either way.
 */
function log(state: World, name: string, what: string): void {
  const [duration = '', date = ''] = what.split(' on ')

  state.entries.push(entry(personOf(name), `${date}T09:00:00Z`, secondsOf(duration)))
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

function rosterFrom(list: string): RosterMember[] {
  return namesFrom(list).map((name) =>
    name === 'a bot' ? member(CAMILA, { bot: true }) : member(personOf(name)),
  )
}

function rowFor(state: World, name: string) {
  return gridOf(state).rows.find((row) => row.person.name === personOf(name).name)
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

/** The two sums the grand total has to agree with, in seconds. */
function totalsOf(grid: TeamGrid): { columns: number; rows: number } {
  return {
    columns: grid.columnTotals.reduce((sum, total) => sum + total.seconds, 0),
    rows: grid.rows.reduce((sum, row) => sum + row.total.seconds, 0),
  }
}

function world(): World {
  return { entries: [], loadedThrough: MAY.to, roster: [], today: '2026-06-15' }
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  Scenario('A member who logged nothing still has a row', ({ And, Given, Then }) => {
    const state = world()

    Given(MEMBERS, (_context, list: string) => {
      state.roster = rosterFrom(list)
    })

    And(LOGGED, (_context, name: string, what: string) => {
      log(state, name, what)
    })

    Then(ROWS, (_context, list: string) => {
      expect(displayedNames(state)).toEqual(expectedNames(list))
    })

    And('the row for {string} holds no visible entries', (_context, name: string) => {
      expect(rowFor(state, name)?.total.entryCount).toBe(0)
    })
  })

  Scenario(
    'Somebody who logged time but is not a member keeps their row',
    ({ And, Given, Then }) => {
      const state = world()

      Given(MEMBERS, (_context, list: string) => {
        state.roster = rosterFrom(list)
      })

      And(LOGGED, (_context, name: string, what: string) => {
        log(state, name, what)
      })

      Then(ROWS, (_context, list: string) => {
        expect(displayedNames(state)).toEqual(expectedNames(list))
      })

      And('the row for {string} is not on the membership', (_context, name: string) => {
        expect(rowFor(state, name)?.onRoster).toBe(false)
      })
    },
  )

  Scenario('A bot on the membership gets no row', ({ Given, Then }) => {
    const state = world()

    Given(MEMBERS, (_context, list: string) => {
      state.roster = rosterFrom(list)
    })

    Then(ROWS, (_context, list: string) => {
      expect(displayedNames(state)).toEqual(expectedNames(list))
    })
  })

  Scenario('Two entries on the same day are one cell', ({ And, Given, Then }) => {
    const state = world()

    Given(MEMBERS, (_context, list: string) => {
      state.roster = rosterFrom(list)
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

    Given(MEMBERS, (_context, list: string) => {
      state.roster = rosterFrom(list)
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

      Given(MEMBERS, (_context, list: string) => {
        state.roster = rosterFrom(list)
      })

      And('the month has been read up to <read>', () => {
        state.loadedThrough = example.read
      })

      And('today is <today>', () => {
        state.today = example.today
      })

      Then('the cell for Ana on <date> is "<kind>"', () => {
        expect(cellFor(state, 'Ana', example.date)?.kind).toBe(example.kind)
      })
    },
  )

  Scenario('The grand total agrees with the rows and with the columns', ({ And, Given, Then }) => {
    const state = world()

    Given(MEMBERS, (_context, list: string) => {
      state.roster = rosterFrom(list)
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

    Given(MEMBERS, (_context, list: string) => {
      state.roster = rosterFrom(list)
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
