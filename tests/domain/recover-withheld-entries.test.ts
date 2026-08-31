import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, beforeAll, expect } from 'vitest'
import {
  recordedTimelogNodes,
  recoveredTimelogsPayload,
  timelogsPayload,
  WITHHELD_POSITIONS,
  withheldTimelogsPayload,
} from '~tests/support/gitlab-timelogs'

import type { TimelogPage } from '@/entities/timelogs/model/ports'
import type { TimelogEntry } from '@/entities/timelogs/model/types'

import { gitLabTimelogGateway } from '@/entities/timelogs/api/gitlab-timelog-gateway'
import { type DayTotal, dayTotals } from '@/entities/timelogs/model/aggregate'
import { type ProjectTotal, projectTotals } from '@/entities/timelogs/model/rollup'
import { graphQLClient, GraphQLRequestError } from '@/shared/api'

const feature = await loadFeature('features/domain/recover-withheld-entries.feature')

const ENDPOINT = 'https://gitlab.example/api/graphql'
const ZONE = 'America/Sao_Paulo'
const WITHHELD_COUNT = WITHHELD_POSITIONS.length

const CREDENTIALS = {
  accessToken: () => Promise.resolve('access-1'),
  refresh: () => Promise.resolve('access-2'),
}

const server = setupServer()

/**
 * What the endpoint is standing in for, this scenario.
 *
 * One handler for the whole file, switched by a variable, because
 * `describeFeature` turns every step into its own test: an `afterEach` that
 * reset the handlers would take them away between a Given and its When.
 */
type Mode = 'no-data' | 'recoverable' | 'unrecoverable' | 'whole'

let mode: Mode = 'whole'

/** How many times the endpoint was asked, so an extra request cannot hide. */
let asked = 0

function answerFor(query: string): Record<string, unknown> {
  if (mode === 'no-data') {
    return { data: null, errors: [{ message: 'Something went wrong' }] }
  }

  if (mode === 'whole') {
    return { data: timelogsPayload() }
  }

  // The recovery request is the one that does not name the project.
  return query.includes('project') || mode === 'unrecoverable'
    ? withheldTimelogsPayload()
    : recoveredTimelogsPayload()
}

/** Hoisted out of the steps: a reduce inside one would nest four callbacks deep. */
function countedSeconds(page: null | TimelogPage): number {
  return (page?.entries ?? []).reduce((total, item) => total + item.seconds, 0)
}

/** An entry as the model holds one, for the scenarios that need no HTTP. */
function entry(seconds: number, project: TimelogEntry['project']): TimelogEntry {
  return {
    project,
    seconds,
    spentAt: new Date('2026-08-20T15:00:00Z'),
    summary: null,
    workItem: null,
  }
}

function gateway() {
  return gitLabTimelogGateway(graphQLClient(ENDPOINT, CREDENTIALS))
}

function loggedSeconds(): number {
  return recordedTimelogNodes().reduce((total, node) => total + node.timeSpent, 0)
}

/** Starts a scenario: what GitLab is about to answer, and no requests counted. */
function serving(next: Mode): void {
  mode = next
  asked = 0
}

function withoutProject(entries: readonly TimelogEntry[]): readonly TimelogEntry[] {
  return entries.filter((candidate) => candidate.project === null)
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
  server.use(
    http.post(ENDPOINT, async ({ request }) => {
      asked += 1
      const body = (await request.json()) as { query: string }

      return HttpResponse.json(answerFor(body.query))
    }),
  )
})

afterAll(() => {
  server.close()
})

describeFeature(feature, ({ Scenario }) => {
  Scenario('Entries and errors arrive together', ({ And, Given, Then, When }) => {
    let page: null | TimelogPage = null

    Given('GitLab withholds three entries of a page and reports why', () => {
      serving('recoverable')
    })

    When('the timelogs are read', async () => {
      page = await gateway().myTimelogs({ after: null })
    })

    Then('the entries GitLab could resolve are reported', () => {
      expect(page?.entries.length).toBeGreaterThanOrEqual(
        recordedTimelogNodes().length - WITHHELD_COUNT,
      )
    })

    And('the answer is not treated as a failure', () => {
      expect(page).not.toBeNull()
    })
  })

  Scenario('An answer carrying errors and nothing else', ({ Given, Then, When }) => {
    let failure: unknown = null

    Given('GitLab answers with errors and no entries at all', () => {
      serving('no-data')
    })

    When('the timelogs are read', async () => {
      try {
        await gateway().myTimelogs({ after: null })
      } catch (error) {
        failure = error
      }
    })

    Then('the request is reported as refused by GitLab', () => {
      expect(failure).toBeInstanceOf(GraphQLRequestError)
      expect(failure).toMatchObject({ failure: { kind: 'rejected' } })
    })
  })

  Scenario('A short answer is not mistaken for a whole one', ({ Given, Then, When }) => {
    let page: null | TimelogPage = null

    Given('GitLab withholds three entries of a page and reports why', () => {
      serving('recoverable')
    })

    When('the timelogs are read', async () => {
      page = await gateway().myTimelogs({ after: null })
    })

    Then('the page says three entries were withheld', () => {
      expect(page?.withheld).toBe(WITHHELD_COUNT)
    })
  })

  Scenario('The withheld hours are recovered and counted', ({ And, Given, Then, When }) => {
    let page: null | TimelogPage = null

    Given('GitLab withholds three entries of a page and reports why', () => {
      serving('recoverable')
    })

    When('the timelogs are read', async () => {
      page = await gateway().myTimelogs({ after: null })
    })

    Then('every entry of the page is counted', () => {
      expect(page?.entries).toHaveLength(recordedTimelogNodes().length)
    })

    And('the hours counted equal the hours logged', () => {
      expect(countedSeconds(page)).toBe(loggedSeconds())
    })

    And('three entries carry no project', () => {
      expect(withoutProject(page?.entries ?? [])).toHaveLength(WITHHELD_COUNT)
    })
  })

  Scenario('An entry already read is not counted twice', ({ And, Given, Then, When }) => {
    let page: null | TimelogPage = null

    Given('GitLab withholds three entries of a page and reports why', () => {
      serving('recoverable')
    })

    And('asking again without the project returns the whole page', () => {
      serving('recoverable')
    })

    When('the timelogs are read', async () => {
      page = await gateway().myTimelogs({ after: null })
    })

    Then('every entry of the page is counted', () => {
      expect(page?.entries).toHaveLength(recordedTimelogNodes().length)
    })

    And('the hours counted equal the hours logged', () => {
      expect(countedSeconds(page)).toBe(loggedSeconds())
    })
  })

  Scenario(
    'A page GitLab answered whole is not asked for a second time',
    ({ Given, Then, When }) => {
      let page: null | TimelogPage = null

      Given('GitLab answers a page with nothing withheld', () => {
        serving('whole')
      })

      When('the timelogs are read', async () => {
        page = await gateway().myTimelogs({ after: null })
      })

      Then('GitLab is asked once', () => {
        expect(asked).toBe(1)
        expect(page?.withheld).toBeUndefined()
      })
    },
  )

  Scenario('An entry nothing can recover', ({ And, Given, Then, When }) => {
    let page: null | TimelogPage = null

    Given('GitLab withholds three entries of a page and reports why', () => {
      serving('recoverable')
    })

    And('asking again without the project withholds them too', () => {
      serving('unrecoverable')
    })

    When('the timelogs are read', async () => {
      page = await gateway().myTimelogs({ after: null })
    })

    Then('the page says three entries were withheld and none recovered', () => {
      expect(page?.withheld).toBe(WITHHELD_COUNT)
      expect(page?.recovered).toBe(0)
    })
  })

  Scenario(
    'A day counts an entry whose project could not be read',
    ({ And, Given, Then, When }) => {
      let entries: TimelogEntry[] = []
      let days: DayTotal[] = []

      Given('a day with an entry of 3600 seconds and no readable project', () => {
        entries = [entry(3600, null)]
      })

      When('the day is aggregated', () => {
        days = dayTotals(entries, ZONE)
      })

      Then('the day total is 1 hours', () => {
        expect(days.at(0)?.hours).toBe(1)
      })

      And('the day shows the entry with no project', () => {
        expect(days.at(0)?.items.at(0)?.project).toBeNull()
      })
    },
  )

  Scenario('Unreadable projects are one group in the split by project', ({ Given, Then, When }) => {
    let days: DayTotal[] = []
    let totals: ProjectTotal[] = []

    Given('two entries in different unreadable projects', () => {
      days = dayTotals([entry(3600, null), entry(1800, null)], ZONE)
    })

    When('the period is split by project', () => {
      totals = projectTotals(days)
    })

    Then('there is one group with no project', () => {
      expect(totals).toHaveLength(1)
      expect(totals.at(0)?.project).toBeNull()
    })
  })
})
