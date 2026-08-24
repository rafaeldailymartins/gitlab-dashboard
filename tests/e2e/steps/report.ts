import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { LOGGED_TODAY } from '../support/gitlab-api'

const { Then, When } = createBdd()

/** The fixture logs time today, so today's row is the newest of the feed. */
const NEWEST_DAY = 0

When('I pick today out of the week strip', async ({ page }) => {
  await page.locator('button[aria-current="date"]').click()
})

When('I open the newest day of the feed', async ({ page }) => {
  await page.getByRole('button', { expanded: false }).nth(NEWEST_DAY).click()
})

When('I reload the day screen for {word}', async ({ page }, date: string) => {
  await page.goto(`/days/${date}`)
  await expect(page.getByRole('main')).toBeVisible()
})

Then('the week strip names today with its hours and its target', async ({ page }) => {
  const today = page.locator('button[aria-current="date"]')

  await expect(today).toHaveAccessibleName(new RegExp(`${String(LOGGED_TODAY)} hours`, 'i'))
  // Which of the two the suite sees depends on the weekday it runs on, and both
  // are the point: a target to measure against, or a day that has none.
  await expect(today).toHaveAccessibleName(/hour target|no target/i)
})

Then('I am on the day screen for {word}', async ({ page }, date: string) => {
  await expect(page).toHaveURL(new RegExp(`/days/${date}$`))
  await expect(page.getByRole('link', { name: /back to the dashboard/i })).toBeVisible()
})

Then('it lists the issue I logged time against', async ({ page }) => {
  const issue = page.getByRole('link', { name: /Totalizador/ })

  // Rows carry `content-visibility: auto`, so a panel below the fold has no box
  // until it is scrolled to — which is what a reader does to read it.
  await issue.scrollIntoViewIfNeeded()
  await expect(issue).toBeVisible()
})

Then('the issue links to GitLab in a new tab', async ({ page }) => {
  const issue = page.getByRole('link', { name: /Totalizador/ })

  await expect(issue).toHaveAttribute('href', /gitlab\.com\/.*\/-\/work_items\/\d+$/)
  await expect(issue).toHaveAttribute('target', '_blank')
})

Then('the feed says that is the whole history', async ({ page }) => {
  await expect(page.getByText(/that is the whole history/i)).toBeVisible()
})

Then('I am on a day screen', async ({ page }) => {
  await expect(page).toHaveURL(/\/days\/\d{4}-\d{2}-\d{2}$/)
  await expect(page.getByRole('link', { name: /back to the dashboard/i })).toBeVisible()
})

Then('it shows a square for every day of the month', async ({ page }) => {
  const days = new Date()
  const inMonth = new Date(days.getFullYear(), days.getMonth() + 1, 0).getDate()
  const grid = page.getByRole('region', { name: /days of the month/i })

  await expect(grid.getByText(/: [\d.,]+ hours?$/).first()).toBeVisible()
  await expect(grid.getByText(/: [\d.,]+ hours?/)).toHaveCount(inMonth)
})

Then('it splits the hours by project', async ({ page }) => {
  const split = page.getByRole('region', { name: /hours by project/i })

  await expect(split.getByRole('listitem').first()).toContainText(/inventariofiscal/)
})

Then('it lists the work items by hours', async ({ page }) => {
  const table = page.getByRole('region', { name: /what took the time/i })

  await expect(table.getByRole('row')).not.toHaveCount(0)
  await expect(table.getByRole('columnheader', { name: /hours/i })).toBeVisible()
})

Then('the feed says nothing has been logged yet', async ({ page }) => {
  await expect(page.getByText(/no time logged in gitlab yet/i)).toBeVisible()
})

Then('the summary reads zero rather than waiting', async ({ page }) => {
  await expect(page.getByRole('group', { name: /^today$/i })).toContainText('0')
})

Then('I am told GitLab could not be reached', async ({ page }) => {
  await expect(page.getByRole('status')).toContainText(/could not be reached/i)
})

Then('I am offered a retry', async ({ page }) => {
  await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()
})
