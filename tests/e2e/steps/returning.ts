import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { LOGGED_TODAY, stubSlowTimelogs, timesAsked } from '../support/gitlab-api'

const { Given, Then, When } = createBdd()

/** Long enough that a request cannot be what put figures on screen. */
const SLOW_ANSWER = 4000

/** The persister writes on a trailing edge one second after the cache changes. */
const PERSIST_INTERVAL = 1500

/**
 * Google's "good" threshold for cumulative layout shift. It is a layout
 * property, so it means the same on a dev server as in production — unlike a
 * paint time, which is why this suite asserts on shift and leaves the timing to
 * the bundle budget.
 */
const CLS_BUDGET = 0.1

Given('my hours have been kept on this device', async ({ page }) => {
  // A fixed wait, deliberately: the persister writes on a trailing edge and
  // nothing in the document says when it has. Polling storage instead would mean
  // reaching into IndexedDB, which tests the persister rather than the promise
  // the reader was made.
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(PERSIST_INTERVAL)
})

Given('GitLab has become slow to answer', async ({ page }) => {
  await stubSlowTimelogs(page, SLOW_ANSWER)
})

When('I come back to the dashboard', async ({ page }) => {
  await page.goto('/')
})

Then(
  'today reads {float} hours before the request has finished',
  async ({ page }, hours: number) => {
    // No extra waiting: the figure has to be there while the request would still
    // be in flight, which is the whole claim.
    await expect(page.getByRole('group', { name: /^today$/i })).toContainText(String(hours))
    expect(hours).toBe(LOGGED_TODAY)
  },
)

Then('GitLab was not asked again', async ({ page }) => {
  // Inside the five-minute freshness window the cache is the answer, so a return
  // visit costs nothing at all.
  await expect(page.getByRole('status')).toContainText(/updated/i)
  expect(timesAsked(page)).toBe(0)
})

Then('today is still loading', async ({ page }) => {
  // The cache went with the session, so there is nothing to paint from and the
  // slow request is all that is left.
  await expect(page.getByRole('group', { name: /^today$/i })).not.toContainText(
    String(LOGGED_TODAY),
  )
  await expect.poll(() => timesAsked(page)).toBeGreaterThan(0)
})

Then('the dashboard settled without shifting its layout', async ({ page }) => {
  await expect(page.getByRole('status')).toBeVisible()

  const shift = await page.evaluate(measureLayoutShift)

  expect(shift).toBeLessThan(CLS_BUDGET)
})

/** Runs in the page. Declared apart so nothing it needs comes from this module. */
function measureLayoutShift(): Promise<number> {
  return new Promise((resolve) => {
    let total = 0
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number }

        if (!shift.hadRecentInput) {
          total += shift.value
        }
      }
    })

    observer.observe({ buffered: true, type: 'layout-shift' })
    setTimeout(() => {
      observer.disconnect()
      resolve(total)
    }, 1000)
  })
}
