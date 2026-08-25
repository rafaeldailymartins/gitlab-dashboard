import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { timesAsked } from '../support/gitlab-api'

const { Then, When } = createBdd()

const SYNC_BUTTON = /sync with gitlab|sincronizar com o gitlab/i

/**
 * How often the endpoint had been asked before the reader pressed sync. Kept
 * beside the page because the claim worth making — pressing it costs a request
 * — spans two steps, and the count before is not zero: the screen has already
 * loaded once.
 */
const asked = new WeakMap<Page, number>()

When('I sync with GitLab', async ({ page }) => {
  asked.set(page, timesAsked(page))
  await page.getByRole('button', { name: SYNC_BUTTON }).click()
})

Then('the report says when it last synced', async ({ page }) => {
  const status = page.getByRole('status')

  await expect(status).toContainText(/updated|atualizado/i)
  // A clock time, which is the part that could not have been written by hand.
  await expect(status).toContainText(/\d{1,2}:\d{2}/)
})

Then('GitLab was asked for the hours again', async ({ page }) => {
  await expect.poll(() => timesAsked(page)).toBeGreaterThan(asked.get(page) ?? 0)
})
