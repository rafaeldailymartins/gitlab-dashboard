import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'

import type { TeamTimelogEntry } from '@/entities/team-timelogs'

import { entriesWithin, readerWindow } from '@/entities/team-timelogs'
import { datesBetween, isoDate, toIsoDate } from '@/shared/lib/date'

const feature = await loadFeature('features/domain/team-month-window.feature')

const MAY = isoDate('2026-05-01')

/**
 * Whether the window covers every instant that can fall on any day of the month
 * in the given zone — both ends of every day, which is where a widened window
 * either holds or does not.
 */
function coversTheMonth(zone: string): boolean {
  const { from, period, to } = readerWindow(MAY)

  return datesBetween(period.from, period.to).every((date) => {
    const first = firstInstantOn(date, zone)
    const last = new Date(first.getTime() + DAY_MS - 1)

    return first.toISOString() >= from && last.toISOString() <= to
  })
}

function entryAt(instant: string): TeamTimelogEntry {
  return { id: 'gid://gitlab/Timelog/1', seconds: 3600, spentAt: new Date(instant) }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Fifteen minutes, because some zones sit on a quarter-hour offset. */
const STEP_MS = 15 * 60 * 1000

/** Thirty hours either side of noon covers UTC-12 to UTC+14 with room to spare. */
const SEARCH_STEPS = (30 * 60 * 60 * 1000) / STEP_MS

/**
 * Local midnight on a calendar date, found rather than computed.
 *
 * An offset is a property of the zone at that instant, so a test that worked one
 * out for itself would be asserting its own arithmetic rather than the app's.
 */
function firstInstantOn(date: string, zone: string): Date {
  const noon = new Date(`${date}T12:00:00Z`)

  for (let step = -SEARCH_STEPS; step <= SEARCH_STEPS; step += 1) {
    const candidate = new Date(noon.getTime() + step * STEP_MS)
    const before = new Date(candidate.getTime() - 1)

    if (toIsoDate(candidate, zone) === date && toIsoDate(before, zone) !== date) {
      return candidate
    }
  }

  throw new Error(`No local midnight found for ${date} in ${zone}`)
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  Scenario('The window is widened past the month at both ends', ({ And, Given, Then }) => {
    let window = readerWindow(MAY)

    Given('a report for the month 2026-05', () => {
      window = readerWindow(MAY)
    })

    Then('the window asked for starts at {string}', (_context, instant: string) => {
      expect(window.from).toBe(instant)
    })

    And('the window asked for ends at {string}', (_context, instant: string) => {
      expect(window.to).toBe(instant)
    })

    And('the period cut from it runs from 2026-05-01 to 2026-05-31', () => {
      expect(window.period).toEqual({ from: '2026-05-01', to: '2026-05-31' })
    })
  })

  ScenarioOutline(
    'The widened window covers the month in every time zone',
    ({ Given, Then }, variables) => {
      const example = variables as { zone: string }

      Given('a report for the month 2026-05', () => {
        expect(readerWindow(MAY).period.from).toBe('2026-05-01')
      })

      Then('the window covers the whole of that month in "<zone>"', () => {
        expect(coversTheMonth(example.zone)).toBe(true)
      })
    },
  )

  Scenario('An entry in the month in one zone is outside it in another', ({ And, Given, Then }) => {
    const { period } = readerWindow(MAY)
    let entries: TeamTimelogEntry[] = []

    Given('a report for the month 2026-05', () => {
      entries = []
    })

    And('an entry recorded at {string}', (_context, instant: string) => {
      entries = [entryAt(instant)]
    })

    Then('the entry is inside the month in {string}', (_context, zone: string) => {
      expect(entriesWithin(entries, period, zone)).toHaveLength(1)
    })

    And('the entry is outside the month in {string}', (_context, zone: string) => {
      expect(entriesWithin(entries, period, zone)).toEqual([])
    })
  })

  Scenario(
    'The padding days the widened window brought back are dropped',
    ({ And, Given, Then }) => {
      const { period } = readerWindow(MAY)
      let entries: TeamTimelogEntry[] = []

      Given('a report for the month 2026-05', () => {
        entries = []
      })

      And('an entry recorded at {string}', (_context, instant: string) => {
        entries = [entryAt(instant)]
      })

      Then('the entry is outside the month in {string}', (_context, zone: string) => {
        expect(entriesWithin(entries, period, zone)).toEqual([])
      })
    },
  )
})
