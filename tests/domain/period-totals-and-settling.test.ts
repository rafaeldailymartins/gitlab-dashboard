import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'

import type { TimelogPage } from '@/entities/timelogs/model/ports'
import type { TimelogEntry } from '@/entities/timelogs/model/types'

import { periodSummary, reportFrom, type TimelogReport } from '@/entities/timelogs/model/report'
import { isoDate } from '@/shared/lib/date'

const feature = await loadFeature('features/domain/period-totals-and-settling.feature')

const ZONE = 'America/Sao_Paulo'
const AUGUST = { from: isoDate('2026-08-01'), to: isoDate('2026-08-31') }
const SECONDS_PER_HOUR = 3600

const PROJECT = {
  fullPath: 'group/project',
  name: 'project',
  webUrl: 'https://gitlab.example/group/project',
}

/** Midday UTC, so the calendar date is unambiguous in the zone used here. */
function entry(hours: number, day: string): TimelogEntry {
  return {
    project: PROJECT,
    seconds: hours * SECONDS_PER_HOUR,
    spentAt: new Date(`${day}T15:00:00Z`),
    summary: null,
    workItem: null,
  }
}

function page(entries: TimelogEntry[], nextCursor: null | string = null): TimelogPage {
  return { entries, nextCursor }
}

/** Extracted so a step stays one level of nesting, not two. */
function pointingAt(pages: TimelogPage[], nextCursor: null | string): TimelogPage[] {
  return pages.map((loaded) => page([...loaded.entries], nextCursor))
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('A period total covers only the days inside it', ({ Given, Then, When }) => {
    let pages: TimelogPage[] = []
    let report: null | TimelogReport = null

    Given('a loaded page with 2 hours on 2026-08-20 and 3 hours on 2026-09-02', () => {
      pages = [page([entry(2, '2026-08-20'), entry(3, '2026-09-02')])]
    })

    When('August 2026 is totalled', () => {
      report = reportFrom(pages, ZONE)
    })

    Then('the total is 2 hours', () => {
      expect(report && periodSummary(report, AUGUST).hours).toBe(2)
    })
  })

  Scenario(
    'A period total is final once history reaches past its start',
    ({ And, Given, Then, When }) => {
      let pages: TimelogPage[] = []
      let report: null | TimelogReport = null

      Given('a loaded page with 2 hours on 2026-08-20 and 3 hours on 2026-07-30', () => {
        pages = [page([entry(2, '2026-08-20'), entry(3, '2026-07-30')])]
      })

      And('there is older history still to load', () => {
        pages = pointingAt(pages, 'older')
      })

      When('August 2026 is totalled', () => {
        report = reportFrom(pages, ZONE)
      })

      Then('the total is settled', () => {
        expect(report && periodSummary(report, AUGUST).settled).toBe(true)
      })
    },
  )

  Scenario(
    'A period total is a floor while its start has not been reached',
    ({ And, Given, Then, When }) => {
      let pages: TimelogPage[] = []
      let report: null | TimelogReport = null

      Given('a loaded page with 2 hours on 2026-08-20', () => {
        pages = [page([entry(2, '2026-08-20')])]
      })

      And('there is older history still to load', () => {
        pages = pointingAt(pages, 'older')
      })

      When('August 2026 is totalled', () => {
        report = reportFrom(pages, ZONE)
      })

      Then('the total is not settled', () => {
        expect(report && periodSummary(report, AUGUST).settled).toBe(false)
      })
    },
  )

  Scenario(
    'A period total is final once there is nothing older anywhere',
    ({ And, Given, Then, When }) => {
      let pages: TimelogPage[] = []
      let report: null | TimelogReport = null

      Given('a loaded page with 2 hours on 2026-08-20', () => {
        pages = [page([entry(2, '2026-08-20')])]
      })

      And('there is nothing older to load', () => {
        pages = pointingAt(pages, null)
      })

      When('August 2026 is totalled', () => {
        report = reportFrom(pages, ZONE)
      })

      Then('the total is settled', () => {
        expect(report && periodSummary(report, AUGUST).settled).toBe(true)
      })
    },
  )

  Scenario('A day split across two pages is one day', ({ Given, Then, When }) => {
    let pages: TimelogPage[] = []
    let report: null | TimelogReport = null

    Given(
      'a first page with 2 hours on 2026-08-20 and a second with 1 hour on the same day',
      () => {
        pages = [page([entry(2, '2026-08-20')], 'older'), page([entry(1, '2026-08-20')])]
      },
    )

    When('the report is read', () => {
      report = reportFrom(pages, ZONE)
    })

    Then('it has one day of 3 hours', () => {
      expect(report?.days).toHaveLength(1)
      expect(report?.days.at(0)?.hours).toBe(3)
    })
  })
})
