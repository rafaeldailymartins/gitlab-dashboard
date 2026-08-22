import type { Page } from '@playwright/test'

const GRAPHQL = '**/api/graphql'

const SECONDS_PER_HOUR = 3600

const PROJECT = {
  fullPath: 'invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
  name: 'invent.fiscal.inventariofiscal',
  webUrl: 'https://gitlab.com/invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
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
    await route.fulfill({
      json: {
        data: {
          currentUser: {
            timelogs: {
              nodes: [
                // `features/acceptance/open-the-dashboard.feature` states these
                // same figures; changing one means changing the other.
                node(0, 6, 153),
                node(1, 3, 129),
                node(40, 4, 128),
              ],
              pageInfo: { endCursor: null, hasNextPage: false },
            },
          },
        },
      },
    })
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
