import type { Page } from '@playwright/test'

const GRAPHQL = '**/api/graphql'

const SECONDS_PER_HOUR = 3600

/** `America/Sao_Paulo`, which is the app's default time-zone preference. */
const ZONE_OFFSET_MS = 3 * 60 * 60 * 1000

const DATE_LENGTH = 'YYYY-MM-DD'.length

const PROJECT = {
  fullPath: 'invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
  name: 'invent.fiscal.inventariofiscal',
  webUrl: 'https://gitlab.com/invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
}

/** Hours the fixture logs today. `features/acceptance/*` state the same number. */
export const LOGGED_TODAY = 6.5

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
 * Midday in the reader's zone, on a day counted from the reader's today.
 *
 * This used to be midday UTC on a day counted from UTC's today, and the suite
 * failed every evening after 21:00 in Brazil: UTC had already rolled over, so
 * `middayUtc(0)` was the reader's tomorrow and "today reads 6.5 hours" found
 * yesterday's three. The app buckets days in `America/Sao_Paulo`, which is the
 * default preference, so the fixture has to count them there too. Brazil has had
 * no daylight saving since 2019, which is what makes a fixed offset honest here.
 */
function middayLocal(daysAgo: number): string {
  const local = new Date(Date.now() - ZONE_OFFSET_MS)
  local.setUTCDate(local.getUTCDate() - daysAgo)

  // Midday in a zone three hours behind UTC, so the entry sits mid-afternoon
  // UTC and lands on the same calendar day whichever side of it is read.
  return `${local.toISOString().slice(0, DATE_LENGTH)}T15:00:00.000Z`
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
    spentAt: middayLocal(daysAgo),
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

/** An endpoint that cannot be reached at all. */
export async function failTimelogs(page: Page): Promise<void> {
  await page.route(GRAPHQL, async (route) => {
    await route.abort('connectionfailed')
  })
}

/** An account with no time logged at all. */
export async function stubEmptyTimelogs(page: Page): Promise<void> {
  await page.route(GRAPHQL, async (route) => {
    await route.fulfill({
      json: {
        data: {
          currentUser: {
            timelogs: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } },
          },
        },
      },
    })
  })
}

export function timesAsked(page: Page): number {
  return asked.get(page)?.count ?? 0
}

function countAsk(page: Page): void {
  const tally = asked.get(page) ?? { count: 0 }
  tally.count += 1
  asked.set(page, tally)
}
