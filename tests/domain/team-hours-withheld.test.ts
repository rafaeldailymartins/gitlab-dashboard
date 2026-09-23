import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { ANA, BRUNO, EIGHT_BY_FIVE, entry, member } from '~tests/support/gitlab-team-timelogs'

import {
  type DeclaredTotals,
  type Person,
  readerWindow,
  type TeamHoursPage,
  type TeamReport,
  teamReportFrom,
  type TeamTimelogEntry,
} from '@/entities/team-timelogs'
import { isoDate } from '@/shared/lib/date'

const feature = await loadFeature('features/domain/team-hours-withheld.feature')

const WINDOW = readerWindow(isoDate('2026-05-01'))
const HOUR = 3600
const PEOPLE: Record<string, Person> = { Ana: ANA, Bruno: BRUNO }

/** One person's answer, as a scenario has described it so far. */
interface Slice {
  complete: boolean
  declared: DeclaredTotals | null
  entries: TeamTimelogEntry[]
  person: Person
}

/** How many entries, and how many hours, said as one thing. */
interface Totals {
  count: number
  hours: number
}

/** The step text, declared once per line a scenario has of it. */
const DECLARED = 'the provider reports {string} for {string}'
const NO_SHORTFALL = 'the row for {string} reports no shortfall'
const NO_VISIBLE_HOURS = 'the row for {string} holds no visible hours'
const SHORT_BY = 'the row for {string} is short by {string} hours'
const TEAM = 'a team of {string}'
const WINDOW_DECLARED = 'the provider reports {string} entries totalling {string} for the month'

function hoursOf(duration: string): number {
  return Number(duration.replace('h', ''))
}

function personOf(name: string): Person {
  const person = PEOPLE[name]

  if (!person) {
    throw new Error(`No fixture for ${name}`)
  }

  return person
}

function reportOf(slices: readonly Slice[]): TeamReport {
  const page: TeamHoursPage = {
    members: slices.map((slice) => ({
      declared: slice.declared,
      entries: slice.entries,
      nextCursor: slice.complete ? null : 'MQ',
      person: slice.person,
    })),
  }

  return teamReportFrom([page], {
    granularity: 'days',
    members: slices.map((slice) => member(slice.person)),
    reference: EIGHT_BY_FIVE,
    timeZone: 'UTC',
    today: isoDate('2026-06-15'),
    window: WINDOW,
  })
}

function rowFor(slices: readonly Slice[], name: string) {
  return reportOf(slices).grid.rows.find((row) => row.member.name === personOf(name).name)
}

/** Enough entries to add up to the hours a scenario says were shown. */
function shownEntries(count: number, hours: number): TeamTimelogEntry[] {
  if (count === 0) {
    return []
  }

  const each = Math.round((hours * HOUR) / count)

  return Array.from({ length: count }, () => entry('2026-05-04T09:00:00Z', each))
}

function sliceFor(slices: Slice[], name: string): Slice | undefined {
  return slices.find((slice) => slice.person.name === personOf(name).name)
}

/** The team a scenario names, nobody declared about and nobody having logged. */
function teamOf(list: string): Slice[] {
  return list
    .split(/,| and /)
    .map((raw) => raw.trim())
    .filter((name) => name !== '')
    .map((name) => ({ complete: true, declared: null, entries: [], person: personOf(name) }))
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('The provider counted more than it showed', ({ And, Given, Then }) => {
    const slices = teamOf('Ana')

    Given(WINDOW_DECLARED, (_context, count: string, total: string) => {
      declare(slices, 'Ana', { count: Number(count), hours: hoursOf(total) })
    })

    And(
      'the reader was shown {string} entries totalling {string}',
      (_context, count: string, total: string) => {
        show(slices, 'Ana', { count: Number(count), hours: hoursOf(total) })
      },
    )

    Then(
      'the report says {string} entries and {string} hours could not be accounted for',
      (_context, count: string, hours: string) => {
        expect(reportOf(slices).shortfall).toMatchObject({
          entryCount: Number(count),
          hours: Number(hours),
        })
      },
    )
  })

  Scenario(
    "The figures on screen are higher than the provider's own total",
    ({ And, Given, Then }) => {
      const slices = teamOf('Ana')

      Given(WINDOW_DECLARED, (_context, count: string, total: string) => {
        declare(slices, 'Ana', { count: Number(count), hours: hoursOf(total) })
      })

      And(
        'the reader was shown {string} entries totalling {string}',
        (_context, count: string, total: string) => {
          show(slices, 'Ana', { count: Number(count), hours: hoursOf(total) })
        },
      )

      Then(
        'the report says the figures may be too high by {string} hours',
        (_context, hours: string) => {
          expect(reportOf(slices).shortfall?.hours).toBe(-Number(hours))
        },
      )
    },
  )

  Scenario('Nothing was withheld', ({ And, Given, Then }) => {
    const slices = teamOf('Ana')

    Given(WINDOW_DECLARED, (_context, count: string, total: string) => {
      declare(slices, 'Ana', { count: Number(count), hours: hoursOf(total) })
    })

    And(
      'the reader was shown {string} entries totalling {string}',
      (_context, count: string, total: string) => {
        show(slices, 'Ana', { count: Number(count), hours: hoursOf(total) })
      },
    )

    Then('the report says nothing is missing', () => {
      expect(reportOf(slices).shortfall).toMatchObject({ entryCount: 0, seconds: 0 })
    })
  })

  Scenario('Nothing is claimed while anybody is still being read', ({ And, Given, Then }) => {
    const slices = teamOf('Ana')

    Given(WINDOW_DECLARED, (_context, count: string, total: string) => {
      declare(slices, 'Ana', { count: Number(count), hours: hoursOf(total) })
    })

    And("Ana's month has not been read in full", () => {
      const slice = sliceFor(slices, 'Ana')

      if (slice) {
        slice.complete = false
      }
    })

    Then('the report makes no claim about what is missing', () => {
      expect(reportOf(slices).shortfall).toBeNull()
    })
  })

  Scenario('A shortfall belongs to the row it came from', ({ And, Given, Then }) => {
    let slices: Slice[] = []

    Given(TEAM, (_context, list: string) => {
      slices = teamOf(list)
    })

    And(DECLARED, (_context, total: string, name: string) => {
      declare(slices, name, { count: 1, hours: hoursOf(total) })
    })

    And('{string} was shown {string}', (_context, name: string, total: string) => {
      show(slices, name, { count: 1, hours: hoursOf(total) })
    })

    Then(SHORT_BY, (_context, name: string, hours: string) => {
      expect(rowFor(slices, name)?.shortfall?.hours).toBe(Number(hours))
    })

    And(NO_SHORTFALL, (_context, name: string) => {
      expect(rowFor(slices, name)?.shortfall).toBeNull()
    })
  })

  Scenario(
    'A person whose whole month is unreadable is not a person who logged nothing',
    ({ And, Given, Then }) => {
      let slices: Slice[] = []

      Given(TEAM, (_context, list: string) => {
        slices = teamOf(list)
      })

      And(DECLARED, (_context, total: string, name: string) => {
        declare(slices, name, { count: 1, hours: hoursOf(total) })
      })

      And('{string} was shown {string}', (_context, name: string, total: string) => {
        show(slices, name, { count: 1, hours: hoursOf(total) })
      })

      Then(SHORT_BY, (_context, name: string, hours: string) => {
        expect(rowFor(slices, name)?.shortfall?.hours).toBe(Number(hours))
      })

      And(NO_VISIBLE_HOURS, (_context, name: string) => {
        expect(rowFor(slices, name)?.total.seconds).toBe(0)
      })

      And(NO_SHORTFALL, (_context, name: string) => {
        expect(rowFor(slices, name)?.shortfall).toBeNull()
      })
    },
  )

  Scenario('Hours logged just outside the month are not hours withheld', ({ And, Given, Then }) => {
    let slices: Slice[] = []

    Given(TEAM, (_context, list: string) => {
      slices = teamOf(list)
    })

    And(DECLARED, (_context, total: string, name: string) => {
      declare(slices, name, { count: 1, hours: hoursOf(total) })
    })

    // Inside the window the provider was asked about — it is widened by a day
    // at each end — and outside the month the matrix draws.
    And(
      '{string} logged {string} on the day before the month began',
      (_context, name: string, total: string) => {
        sliceFor(slices, name)?.entries.push(entry('2026-04-30T09:00:00Z', hoursOf(total) * HOUR))
      },
    )

    Then(NO_SHORTFALL, (_context, name: string) => {
      expect(rowFor(slices, name)?.shortfall?.seconds).toBe(0)
    })

    And(NO_VISIBLE_HOURS, (_context, name: string) => {
      expect(rowFor(slices, name)?.total.seconds).toBe(0)
    })
  })
})

/** What the provider says one person's window holds, before it removed anything. */
function declare(slices: Slice[], name: string, totals: Totals): void {
  const slice = sliceFor(slices, name)

  if (slice) {
    slice.declared = { entryCount: totals.count, seconds: totals.hours * HOUR }
  }
}

/** What the provider actually handed over for one person. */
function show(slices: Slice[], name: string, totals: Totals): void {
  const slice = sliceFor(slices, name)

  if (slice) {
    slice.entries = totals.hours > 0 ? shownEntries(totals.count, totals.hours) : []
  }
}
