import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { stubTimelogs } from '../support/gitlab-api'

const { Given, Then, When } = createBdd()

const AUTHORIZE = '**/oauth/authorize*'
const TOKEN = '**/oauth/token'
const REVOKE = '**/oauth/revoke'

const ORIGIN = 'http://localhost:3000'

/**
 * Stands in for GitLab's authorization page.
 *
 * The real page cannot be driven from a test — it needs a human and a real
 * account — so what gets stubbed is the redirect it would perform. The `state`
 * is echoed back from the request the app actually sent, so the check that a
 * callback belongs to this attempt is genuinely exercised rather than bypassed.
 */
async function stubAuthorization(page: Page, outcome: 'granted' | 'refused'): Promise<void> {
  await page.route(AUTHORIZE, async (route) => {
    const sent = new URL(route.request().url())
    const callback = new URL('/auth/callback', ORIGIN)

    if (outcome === 'granted') {
      callback.searchParams.set('code', 'test-authorization-code')
      callback.searchParams.set('state', sent.searchParams.get('state') ?? '')
    } else {
      callback.searchParams.set('error', 'access_denied')
    }

    await route.fulfill({
      body: `<meta http-equiv="refresh" content="0;url=${callback.toString()}">`,
      contentType: 'text/html',
    })
  })

  await page.route(TOKEN, async (route) => {
    await route.fulfill({
      json: { access_token: 'test-access', expires_in: 7200, refresh_token: 'test-refresh' },
    })
  })

  await page.route(REVOKE, async (route) => {
    await route.fulfill({ status: 200 })
  })
}

Given('GitLab will authorise this application', async ({ page }) => {
  await stubAuthorization(page, 'granted')
})

Given('GitLab will refuse to authorise this application', async ({ page }) => {
  await stubAuthorization(page, 'refused')
})

Given('I am signed in', async ({ page }) => {
  await stubAuthorization(page, 'granted')
  await stubTimelogs(page)
  await page.goto('/')
  await page.getByRole('button', { name: /continue with gitlab/i }).click()
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
  // The header appears while the callback is still navigating on to the
  // dashboard. Waiting for something only the dashboard renders is what makes
  // the next step's navigation safe: otherwise it cancels this one mid-flight.
  await expect(page.getByRole('status')).toBeVisible()
})

When('I continue with GitLab', async ({ page }) => {
  await page.getByRole('button', { name: /continue with gitlab/i }).click()
})

When('I sign out', async ({ page }) => {
  await page.getByRole('button', { name: /sign out/i }).click()
})

Then('I am asked to sign in', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: /sign in/i })).toBeVisible()
})

Then('there is nowhere to paste a token', async ({ page }) => {
  await expect(page.locator('input')).toHaveCount(0)
})

Then('I am told the sign-in did not complete', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: /did not complete/i })).toBeVisible()
})

Then('I am offered another attempt', async ({ page }) => {
  await expect(page.getByRole('link', { name: /try again/i })).toBeVisible()
})

Then('no credential remains on the device', async ({ page }) => {
  const stored = await page.evaluate(() => globalThis.localStorage.getItem('gitlab.refreshToken'))

  expect(stored).toBeNull()
})
