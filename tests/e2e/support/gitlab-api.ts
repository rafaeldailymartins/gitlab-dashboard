import type { Page } from '@playwright/test'

const GRAPHQL = '**/api/graphql'

const SECONDS_PER_HOUR = 3600

const PROJECT = {
  fullPath: 'invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
  name: 'invent.fiscal.inventariofiscal',
  webUrl: 'https://gitlab.com/invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
}

/** Hours the fixture logs today. `features/acceptance/*` state the same number. */
export const LOGGED_TODAY = 6

/** Answers slowly, so a test can see what the reader sees before data arrives. */
export async function stubSlowTimelogs(page: Page, delayMs: number): Promise<void> {
  asked.set(page, { count: 0 })
  await page.route(GRAPHQL, async (route) => {
    countAsk(page)
    await new Promise((resolve) => {
      setTimeout(resolve, delayMs)
    })
    await route.fulfill({ json: payload() })
  })
}

/**
 * Stands in for GitLab's GraphQL endpoint.
 *
 * The real one needs a real account, and a real account's hours change every
 * day. Stubbing it is what lets the suite assert on figures rather than on the
 * mere presence of a number.
 */
export async function stubTimelogs(page: Page): Promise<void> {
  await page.route(GRAPHQL, async (route) => {
    await route.fulfill({ json: payload() })
  })
}

/**
 * Midday UTC on a day relative to now, so the calendar date is the same in every
 * zone the suite runs in and the fixture does not drift across midnight.
 */
function middayUtc(daysAgo: number): string {
  const day = new Date()
  day.setUTCDate(day.getUTCDate() - daysAgo)
  day.setUTCHours(12, 0, 0, 0)

  return day.toISOString()
}

function node(daysAgo: number, hours: number, iid: number) {
  return {
    issue: {
      reference: `${PROJECT.fullPath}#${String(iid)}`,
      title: 'Totalizador de valor de estoque do inventário',
      webUrl: `${PROJECT.webUrl}/-/work_items/${String(iid)}`,
    },
    mergeRequest: null,
    project: PROJECT,
    spentAt: middayUtc(daysAgo),
    summary: '',
    timeSpent: hours * SECONDS_PER_HOUR,
  }
}

/** One page of hours, ending the history. */
function payload() {
  return {
    data: {
      currentUser: {
        timelogs: {
          nodes: [
            // The acceptance features state these same figures; changing one
            // means changing the other.
            node(0, LOGGED_TODAY, 153),
            node(1, 3, 129),
            node(40, 4, 128),
          ],
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      },
    },
  }
}

/**
 * How many times the endpoint has been asked since it was stubbed.
 *
 * Kept beside the page rather than in a step, because Gherkin steps share
 * nothing but the page and the claim worth making — a return visit costs no
 * request — spans two of them.
 */
const asked = new WeakMap<Page, { count: number }>()

export function timesAsked(page: Page): number {
  return asked.get(page)?.count ?? 0
}

function countAsk(page: Page): void {
  const tally = asked.get(page) ?? { count: 0 }
  tally.count += 1
  asked.set(page, tally)
}
