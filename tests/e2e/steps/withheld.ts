import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import {
  HOURS_YESTERDAY,
  stubUnreadableTimelogs,
  stubWithheldTimelogs,
} from '../support/gitlab-api'

const { Given, Then, When } = createBdd()

/** Both languages, because the suite does not fix the browser's locale. */
const NO_PROJECT = /no project reported|projeto não informado/i
const REFUSED = /refused the request|recusou a requisição/i
const WITHOUT_PROJECT = /without their project: 1|sem projeto: 1/i
const UNREAD = /could not read: 1|não conseguiu ler: 1/i

Given('GitLab withholds an entry of my history', async ({ page }) => {
  await stubWithheldTimelogs(page)
})

Given('GitLab withholds an entry nothing can recover', async ({ page }) => {
  await stubUnreadableTimelogs(page)
})

When('I open the day GitLab withheld an entry from', async ({ page }) => {
  // `expanded` picks the feed row rather than the week strip's bar for the same
  // day. Both announce the hours, and whether they collide depends on the day of
  // the week the suite runs on: yesterday is inside the current week from
  // Tuesday onwards. Only the feed row expands, so that is what identifies it.
  const day = page.getByRole('button', {
    expanded: false,
    name: new RegExp(`${String(HOURS_YESTERDAY)} hours`),
  })

  await day.scrollIntoViewIfNeeded()
  await day.click()
})

Then('I am not told the request was refused', async ({ page }) => {
  await expect(page.getByRole('status')).not.toContainText(REFUSED)
})

Then('the report says one entry was counted without its project', async ({ page }) => {
  await expect(page.getByRole('status')).toContainText(WITHOUT_PROJECT)
})

Then('the report says the figures are short by an entry it could not read', async ({ page }) => {
  await expect(page.getByRole('status')).toContainText(UNREAD)
})

Then('the entry says its project was not reported', async ({ page }) => {
  const named = page.getByText(NO_PROJECT).first()

  await named.scrollIntoViewIfNeeded()
  await expect(named).toBeVisible()
})
