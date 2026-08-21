import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, Then } = createBdd()

/** WCAG 2.1 A and AA: the level this project holds itself to. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

Given('my system prefers the {word} colour scheme', async ({ page }, scheme: string) => {
  await page.emulateMedia({ colorScheme: scheme === 'dark' ? 'dark' : 'light' })
})

// Step text is matched regardless of the Given/When/Then keyword, so this one
// definition serves both "Given I open the dashboard" and "When I open ...".
Given('I open the dashboard', async ({ page }) => {
  await page.goto('/')
})

Then('I see the page heading', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

Then('the page has no accessibility violations', async ({ page }) => {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  const summary = results.violations.map(
    (violation) => `${violation.id} (${String(violation.nodes.length)} nodes): ${violation.help}`,
  )

  expect(summary).toEqual([])
})
