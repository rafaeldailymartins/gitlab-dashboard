import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { ANA, BRUNO, entry, member, SQUAD_FISCAL } from '~tests/support/gitlab-group-timelogs'

import {
  type DeclaredTotals,
  type GroupHoursPage,
  type GroupReport,
  groupReportFrom,
  type GroupTimelogEntry,
  type Person,
  readerWindow,
  REFERENCE_SCHEDULE,
  type RosterMember,
  teamGrid,
} from '@/entities/group-timelogs'
import { isoDate } from '@/shared/lib/date'

const feature = await loadFeature('features/domain/group-hours-withheld.feature')

const WINDOW = readerWindow(isoDate('2026-05-01'))
const HOUR = 3600
const PEOPLE: Record<string, Person> = { Ana: ANA, Bruno: BRUNO }

/** What the per-row scenarios accumulate. */
interface Rows {
  entries: GroupTimelogEntry[]
  perPerson: Map<string, DeclaredTotals>
  roster: RosterMember[]
}

/** What the group-level scenarios accumulate before asking for a report. */
interface Window {
  complete: boolean
  declared: DeclaredTotals
  entries: GroupTimelogEntry[]
}

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

function reportOf(state: Window): GroupReport {
  const page: GroupHoursPage = {
    entries: state.entries,
    group: SQUAD_FISCAL,
    nextCursor: state.complete ? null : 'MQ',
  }

  return groupReportFrom([page], {
    granularity: 'days',
    probe: {
      access: null,
      declared: state.declared,
      group: SQUAD_FISCAL,
      perPerson: new Map(),
    },
    reference: REFERENCE_SCHEDULE,
    roster: [member(ANA)],
    timeZone: 'UTC',
    today: isoDate('2026-06-15'),
    window: WINDOW,
  })
}

function rosterFrom(list: string): RosterMember[] {
  return list
    .split(/,| and /)
    .map((raw) => raw.trim())
    .filter((name) => name !== '')
    .map((name) => member(personOf(name)))
}

function rowFor(state: Rows, name: string) {
  return teamGrid({
    entries: state.entries,
    granularity: 'days',
    loadedThrough: WINDOW.period.to,
    period: WINDOW.period,
    perPerson: state.perPerson,
    reference: REFERENCE_SCHEDULE,
    roster: state.roster,
    timeZone: 'UTC',
    today: isoDate('2026-06-15'),
  }).rows.find((row) => row.person.name === personOf(name).name)
}

/** Enough entries to add up to the hours a scenario says were shown. */
function shownEntries(count: number, hours: number): GroupTimelogEntry[] {
  if (count === 0) {
    return []
  }

  const each = Math.round((hours * HOUR) / count)

  return Array.from({ length: count }, () => entry(ANA, '2026-05-04T09:00:00Z', each))
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('The provider counted more than it showed', ({ And, Given, Then }) => {
    const state: Window = { complete: true, declared: { entryCount: 0, seconds: 0 }, entries: [] }

    Given(
      'the provider reports {string} entries totalling {string} for the month',
      (_context, count: string, total: string) => {
        state.declared = { entryCount: Number(count), seconds: hoursOf(total) * HOUR }
      },
    )

    And(
      'the reader was shown {string} entries totalling {string}',
      (_context, count: string, total: string) => {
        state.entries = shownEntries(Number(count), hoursOf(total))
      },
    )

    Then(
      'the report says {string} entries and {string} hours are missing',
      (_context, count: string, hours: string) => {
        expect(reportOf(state).shortfall).toMatchObject({
          entryCount: Number(count),
          hours: Number(hours),
        })
      },
    )
  })

  Scenario(
    "The figures on screen are higher than the provider's own total",
    ({ And, Given, Then }) => {
      const state: Window = { complete: true, declared: { entryCount: 0, seconds: 0 }, entries: [] }

      Given(
        'the provider reports {string} entries totalling {string} for the month',
        (_context, count: string, total: string) => {
          state.declared = { entryCount: Number(count), seconds: hoursOf(total) * HOUR }
        },
      )

      And(
        'the reader was shown {string} entries totalling {string}',
        (_context, count: string, total: string) => {
          state.entries = shownEntries(Number(count), hoursOf(total))
        },
      )

      Then(
        'the report says the figures may be too high by {string} hours',
        (_context, hours: string) => {
          expect(reportOf(state).shortfall?.hours).toBe(-Number(hours))
        },
      )
    },
  )

  Scenario('Nothing was withheld', ({ And, Given, Then }) => {
    const state: Window = { complete: true, declared: { entryCount: 0, seconds: 0 }, entries: [] }

    Given(
      'the provider reports {string} entries totalling {string} for the month',
      (_context, count: string, total: string) => {
        state.declared = { entryCount: Number(count), seconds: hoursOf(total) * HOUR }
      },
    )

    And(
      'the reader was shown {string} entries totalling {string}',
      (_context, count: string, total: string) => {
        state.entries = shownEntries(Number(count), hoursOf(total))
      },
    )

    Then('the report says nothing is missing', () => {
      expect(reportOf(state).shortfall).toMatchObject({ entryCount: 0, seconds: 0 })
    })
  })

  Scenario('Nothing is claimed while the month is still being read', ({ And, Given, Then }) => {
    const state: Window = { complete: true, declared: { entryCount: 0, seconds: 0 }, entries: [] }

    Given(
      'the provider reports {string} entries totalling {string} for the month',
      (_context, count: string, total: string) => {
        state.declared = { entryCount: Number(count), seconds: hoursOf(total) * HOUR }
      },
    )

    And('the month has not been read in full', () => {
      state.complete = false
    })

    Then('the report makes no claim about what is missing', () => {
      expect(reportOf(state).shortfall).toBeNull()
    })
  })

  Scenario('A shortfall belongs to the row it came from', ({ And, Given, Then }) => {
    const state: Rows = { entries: [], perPerson: new Map(), roster: [] }

    Given('a group whose members are {string}', (_context, list: string) => {
      state.roster = rosterFrom(list)
    })

    And('the provider reports {string} for {string}', (_context, total: string, name: string) => {
      state.perPerson.set(personOf(name).username, {
        entryCount: 1,
        seconds: hoursOf(total) * HOUR,
      })
    })

    And('{string} was shown {string}', (_context, name: string, total: string) => {
      const hours = hoursOf(total)

      if (hours > 0) {
        state.entries.push(entry(personOf(name), '2026-05-04T09:00:00Z', hours * HOUR))
      }
    })

    Then(
      'the row for {string} is short by {string} hours',
      (_context, name: string, hours: string) => {
        expect(rowFor(state, name)?.shortfall?.hours).toBe(Number(hours))
      },
    )

    And('the row for {string} reports no shortfall', (_context, name: string) => {
      expect(rowFor(state, name)?.shortfall).toBeNull()
    })
  })

  Scenario(
    'A person whose whole month is unreadable is not a person who logged nothing',
    ({ And, Given, Then }) => {
      const state: Rows = { entries: [], perPerson: new Map(), roster: [] }

      Given('a group whose members are {string}', (_context, list: string) => {
        state.roster = rosterFrom(list)
      })

      And('the provider reports {string} for {string}', (_context, total: string, name: string) => {
        state.perPerson.set(personOf(name).username, {
          entryCount: 1,
          seconds: hoursOf(total) * HOUR,
        })
      })

      And('{string} was shown {string}', (_context, name: string, total: string) => {
        const hours = hoursOf(total)

        if (hours > 0) {
          state.entries.push(entry(personOf(name), '2026-05-04T09:00:00Z', hours * HOUR))
        }
      })

      Then(
        'the row for {string} is short by {string} hours',
        (_context, name: string, hours: string) => {
          expect(rowFor(state, name)?.shortfall?.hours).toBe(Number(hours))
        },
      )

      And('the row for {string} holds no visible hours', (_context, name: string) => {
        expect(rowFor(state, name)?.total.seconds).toBe(0)
      })

      And('the row for {string} reports no shortfall', (_context, name: string) => {
        expect(rowFor(state, name)?.shortfall).toBeNull()
      })
    },
  )

  Scenario('Hours logged just outside the month are not hours withheld', ({ And, Given, Then }) => {
    const state: Rows = { entries: [], perPerson: new Map(), roster: [] }

    Given('a group whose members are {string}', (_context, list: string) => {
      state.roster = rosterFrom(list)
    })

    And('the provider reports {string} for {string}', (_context, total: string, name: string) => {
      state.perPerson.set(personOf(name).username, {
        entryCount: 1,
        seconds: hoursOf(total) * HOUR,
      })
    })

    // Inside the window the provider was asked about — it is widened by a day
    // at each end — and outside the month the matrix draws.
    And(
      '{string} logged {string} on the day before the month began',
      (_context, name: string, total: string) => {
        state.entries.push(entry(personOf(name), '2026-04-30T09:00:00Z', hoursOf(total) * HOUR))
      },
    )

    Then('the row for {string} reports no shortfall', (_context, name: string) => {
      expect(rowFor(state, name)?.shortfall?.seconds).toBe(0)
    })

    And('the row for {string} holds no visible hours', (_context, name: string) => {
      expect(rowFor(state, name)?.total.seconds).toBe(0)
    })
  })
})
