import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'

import type { TimelogEntry } from '@/entities/timelogs/model/types'

import { dayTotals, entriesWithin } from '@/entities/timelogs/model/aggregate'
import { isoDate } from '@/shared/lib/date'

const feature = await loadFeature('features/domain/timezone-day-boundaries.feature')

const PROJECT = {
  fullPath: 'group/project',
  name: 'project',
  webUrl: 'https://gitlab.example/group/project',
}

function dayCount(entries: readonly TimelogEntry[], zone: string): number {
  return dayTotals(entries, zone).length
}

function entryAt(instant: string): TimelogEntry {
  return {
    project: PROJECT,
    seconds: 3600,
    spentAt: new Date(instant),
    summary: null,
    workItem: null,
  }
}

/** Midday UTC, so the calendar date is unambiguous in the zones used here. */
function entryOn(date: string): TimelogEntry {
  return entryAt(`${date}T15:00:00Z`)
}

const PERIOD_ENTRIES = ['2026-08-18', '2026-08-19', '2026-08-21', '2026-08-22'].map((date) =>
  entryOn(date),
)

/** Extracted so a step stays one level of nesting, not two. */
function daysOf(entries: readonly TimelogEntry[]): string[] {
  return entries.map((entry) => entry.spentAt.toISOString().slice(0, 10))
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  // In an outline, steps are matched by their raw text — placeholders and all —
  // and the example values arrive through `variables`, not as step parameters.
  ScenarioOutline(
    'An instant late at night belongs to the day it still was',
    ({ Given, Then, When }, variables) => {
      const example = variables as { date: string; zone: string }
      let entries: TimelogEntry[] = []
      let day: string | undefined

      Given('an entry recorded at "2026-08-21T02:00:00Z"', () => {
        entries = [entryAt('2026-08-21T02:00:00Z')]
      })

      When('the day is decided in "<zone>"', () => {
        day = dayTotals(entries, example.zone).at(0)?.date
      })

      Then('the entry belongs to <date>', () => {
        expect(day).toBe(example.date)
      })
    },
  )

  Scenario(
    'An instant in the afternoon can already be tomorrow further east',
    ({ Given, Then, When }) => {
      let entries: TimelogEntry[] = []
      let day: string | undefined

      Given('an entry recorded at {string}', (_context, instant: string) => {
        entries = [entryAt(instant)]
      })

      When('the day is decided in {string}', (_context, zone: string) => {
        day = dayTotals(entries, zone).at(0)?.date
      })

      Then('the entry belongs to 2026-08-21', () => {
        expect(day).toBe('2026-08-21')
      })
    },
  )

  Scenario('Two entries share a day in one zone and not in another', ({ And, Given, Then }) => {
    const entries: TimelogEntry[] = []

    Given('an entry recorded at {string}', (_context, instant: string) => {
      entries.push(entryAt(instant))
    })

    And('a second entry recorded at {string}', (_context, instant: string) => {
      entries.push(entryAt(instant))
    })

    Then('they share one day in {string}', (_context, zone: string) => {
      expect(dayCount(entries, zone)).toBe(1)
    })

    And('they fall on different days in {string}', (_context, zone: string) => {
      // A naive implementation that grouped in UTC would show two days here,
      // splitting an evening's work in two.
      expect(dayCount(entries, zone)).toBe(2)
    })
  })

  Scenario('The requested period includes its own edges', ({ Given, Then, When }) => {
    let entries: TimelogEntry[] = []
    let kept: TimelogEntry[] = []

    Given('entries recorded on 2026-08-18, 2026-08-19, 2026-08-21 and 2026-08-22', () => {
      entries = PERIOD_ENTRIES
    })

    When(
      'the period from 2026-08-19 to 2026-08-21 is selected in {string}',
      (_context, zone: string) => {
        kept = entriesWithin(
          entries,
          { from: isoDate('2026-08-19'), to: isoDate('2026-08-21') },
          zone,
        )
      },
    )

    Then('only the entries on 2026-08-19 and 2026-08-21 remain', () => {
      expect(kept).toHaveLength(2)
      expect(daysOf(kept)).toEqual(['2026-08-19', '2026-08-21'])
    })
  })
})
