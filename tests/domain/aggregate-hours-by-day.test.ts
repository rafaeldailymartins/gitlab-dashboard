import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'

import type { TimelogEntry } from '@/entities/timelogs/model/types'

import {
  type DayTotal,
  dayTotals,
  periodTotal,
  type PeriodTotal,
} from '@/entities/timelogs/model/aggregate'

const feature = await loadFeature('features/domain/aggregate-hours-by-day.feature')

const ZONE = 'America/Sao_Paulo'
const MIDDAY = '2026-08-20T15:00:00Z'

const PROJECT = {
  fullPath: 'group/project',
  name: 'project',
  webUrl: 'https://gitlab.example/group/project',
}

function entry(seconds: number, reference: null | string): TimelogEntry {
  return {
    project: PROJECT,
    seconds,
    spentAt: new Date(MIDDAY),
    summary: null,
    workItem:
      reference === null
        ? null
        : {
            kind: 'issue',
            reference,
            title: 'An issue',
            webUrl: `https://gitlab.example/${reference}`,
          },
  }
}

/** Extracted so a step stays one level of nesting, not two. */
function totalSeconds(items: readonly { seconds: number }[]): number {
  return items.reduce((total, item) => total + item.seconds, 0)
}

describeFeature(feature, ({ Scenario }) => {
  Scenario(
    'A period total is the sum of what was logged, not of rounded days',
    ({ And, Given, Then, When }) => {
      let entries: TimelogEntry[] = []
      let total: null | PeriodTotal = null

      Given('three entries of 100 seconds each', () => {
        entries = [entry(100, null), entry(100, null), entry(100, null)]
      })

      When('the period total is calculated', () => {
        total = periodTotal(entries)
      })

      Then('it is 0.08 hours', () => {
        expect(total?.hours).toBe(0.08)
      })

      And('it is not 0.09 hours', () => {
        // Three separately rounded 0.03h figures would give 0.09h.
        expect(total?.hours).not.toBe(0.09)
      })
    },
  )

  Scenario('A correction subtracts from the total', ({ Given, Then, When }) => {
    let entries: TimelogEntry[] = []
    let total: null | PeriodTotal = null

    Given('an entry of 7200 seconds and a correction of -3600 seconds', () => {
      entries = [entry(7200, null), entry(-3600, null)]
    })

    When('the period total is calculated', () => {
      total = periodTotal(entries)
    })

    Then('it is 1 hours', () => {
      expect(total?.hours).toBe(1)
    })
  })

  Scenario(
    'Two entries on the same issue on the same day are one row',
    ({ And, Given, Then, When }) => {
      let entries: TimelogEntry[] = []
      let day: DayTotal | undefined

      Given('two entries on issue {string} on the same day', (_context, reference: string) => {
        entries = [entry(2700, reference), entry(24_120, reference)]
      })

      When('the day is aggregated', () => {
        day = dayTotals(entries, ZONE).at(0)
      })

      Then('it has one work item', () => {
        expect(day?.items).toHaveLength(1)
      })

      And('that work item counts both entries', () => {
        expect(day?.items.at(0)?.entryCount).toBe(2)
        expect(day?.items.at(0)?.seconds).toBe(26_820)
      })
    },
  )

  Scenario('A day lists what was worked on, busiest first', ({ And, Given, Then, When }) => {
    const entries: TimelogEntry[] = []
    let day: DayTotal | undefined

    Given('an entry of 1800 seconds on issue {string}', (_context, reference: string) => {
      entries.push(entry(1800, reference))
    })

    And('an entry of 24120 seconds on issue {string}', (_context, reference: string) => {
      entries.push(entry(24_120, reference))
    })

    When('the day is aggregated', () => {
      day = dayTotals(entries, ZONE).at(0)
    })

    Then('the first work item is {string}', (_context, reference: string) => {
      expect(day?.items.at(0)?.workItem?.reference).toBe(reference)
    })

    And('the day total equals the sum of its work items', () => {
      expect(totalSeconds(day?.items ?? [])).toBe(day?.seconds)
    })
  })

  Scenario('Time logged without an issue still counts', ({ And, Given, Then, When }) => {
    let entries: TimelogEntry[] = []
    let day: DayTotal | undefined

    Given('an entry of 3600 seconds with no work item', () => {
      entries = [entry(3600, null)]
    })

    When('the day is aggregated', () => {
      day = dayTotals(entries, ZONE).at(0)
    })

    Then('the day total is 1 hours', () => {
      expect(day?.hours).toBe(1)
    })

    And('the day shows it as unattributed', () => {
      expect(day?.items).toHaveLength(1)
      expect(day?.items.at(0)?.workItem).toBeNull()
    })
  })
})
