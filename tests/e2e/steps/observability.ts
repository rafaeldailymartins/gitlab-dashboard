import { expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createBdd } from 'playwright-bdd'

import { VIEWER_NAME } from '../support/gitlab-api'
import { BRUNO } from '../support/gitlab-teams'
import { eventsSent, recordFaultReports, reportsSent } from '../support/monitor-api'
import { FISCAL_TEAM } from '../support/teams-api'

const { Given, Then, When } = createBdd()

/** What `playwright.config.ts` builds the acceptance bundle for. */
const ACCEPTANCE_RELEASE = 'acceptance'
const ACCEPTANCE_ENVIRONMENT = 'staging'

/** Long enough for the retries to be spent and the reporting chunk to arrive. */
const REPORT_TIMEOUT = 15_000

/** Runs in the page: whether the reporting chunk has been fetched yet. */
function fetchedReportingCode(): boolean {
  return performance
    .getEntriesByType('resource')
    .some((entry) => entry.name.includes('/assets/monitoring-sdk-'))
}

Given('fault reports are being recorded', async ({ page }) => {
  await recordFaultReports(page)
})

Given('the reporting endpoint refuses every report', async ({ page }) => {
  await recordFaultReports(page, 503)
})

When('something on the page fails that nothing catches', async ({ page }) => {
  // The message names the team on purpose: a fault can quote anything, and the
  // report must not carry it on.
  await page.evaluate((team) => {
    setTimeout(() => {
      throw new Error(`${team} could not be drawn`)
    }, 0)
  }, FISCAL_TEAM.name)
})

Then('a fault report is sent', async ({ page }) => {
  await expect.poll(() => eventsSent(page).length, { timeout: REPORT_TIMEOUT }).toBeGreaterThan(0)
})

Then('no fault report contains my name or my access token', ({ page }) => {
  const sent = reportsSent(page).join('\n')

  expect(sent).not.toContain(VIEWER_NAME)
  expect(sent).not.toContain('test-access-')
})

Then(
  "no fault report contains the team's name, the group's path or anybody on the team",
  ({ page }) => {
    const sent = reportsSent(page).join('\n')

    for (const forbidden of [
      FISCAL_TEAM.name,
      FISCAL_TEAM.id,
      'squad-fiscal',
      ...FISCAL_TEAM.members.map((member) => member.name),
      BRUNO.username,
    ]) {
      expect(sent).not.toContain(forbidden)
    }
  },
)

Then('it names the commit and the deploy the site was built for', ({ page }) => {
  expect(eventsSent(page)[0]).toMatchObject({
    environment: ACCEPTANCE_ENVIRONMENT,
    release: ACCEPTANCE_RELEASE,
  })
})

Then('the policy lets the page reach this site and GitLab, and nothing else', async () => {
  const headers = await readFile('dist/_headers', 'utf8')
  const connect = /connect-src ([^;]+)/u.exec(headers)?.[1]?.trim().split(/\s+/u) ?? []

  expect(connect).toHaveLength(2)
  expect(connect[0]).toBe("'self'")
  expect(new URL(connect[1] ?? '').hostname).toMatch(/gitlab/u)
})

/*
 * What the first load is, by the same reading `.size-limit.js` makes: every
 * file the served document asks for. The reporting chunk is not among them.
 */
Then('the page the site serves asks for no reporting code', async ({ request }) => {
  const document = await request.get('/')
  const html = await document.text()

  expect(html).toMatch(/<script/u)
  expect(html).not.toMatch(/monitoring/u)
})

Then('the reporting code is fetched afterwards', async ({ page }) => {
  await expect
    .poll(() => page.evaluate(fetchedReportingCode), { timeout: REPORT_TIMEOUT })
    .toBe(true)
})
