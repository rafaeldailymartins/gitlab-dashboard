import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, Then, When } = createBdd()

/**
 * WCAG 2.1 A and AA, plus axe's best-practice rules. The best-practice set is
 * stricter than the standard requires — unique landmarks, heading order,
 * meaningful link text — and catches the things a reader notices before a
 * checklist does.
 */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']

Given('my system prefers the {word} colour scheme', async ({ page }, scheme: string) => {
  await page.emulateMedia({ colorScheme: scheme === 'dark' ? 'dark' : 'light' })
})

// Step text is matched regardless of the Given/When/Then keyword, so this one
// definition serves both "Given I open the dashboard" and "When I open ...".
Given('I open the dashboard', async ({ page }) => {
  await page.goto('/')

  // `goto` resolves on the load event, when a client-rendered app has painted
  // nothing yet. Auditing at that point measures an empty document — which is
  // how this suite first "passed" on chromium and failed on webkit. Waiting for
  // the main landmark makes the step mean what it says.
  await expect(page.getByRole('main')).toBeVisible()
})

When('I open the settings page', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByRole('main')).toBeVisible()
})

Then('I see the dashboard', async ({ page }) => {
  await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
})

Then('I am on the settings page', async ({ page }) => {
  await expect(
    page.getByRole('heading', { level: 1, name: /settings|configurações/i }),
  ).toBeVisible()
})

Then('I see the page heading', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

Then('the page has no accessibility violations', async ({ page }) => {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  const summary = results.violations.map(
    (violation) => `${violation.id} (${String(violation.nodes.length)} nodes): ${violation.help}`,
  )

  expect(summary).toEqual([])
})

Then('today reads {int} hours', async ({ page }, hours: number) => {
  const today = page.getByRole('group', { name: /^(today|hoje)$/i })

  await expect(today).toContainText(String(hours))
})

Then('the report says it is up to date', async ({ page }) => {
  await expect(page.getByRole('status')).toContainText(/up to date|atualizado/i)
})
