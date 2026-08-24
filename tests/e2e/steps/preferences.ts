import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { stubTimelogs } from '../support/gitlab-api'

const { Given, Then, When } = createBdd()

When('I choose Portuguese', async ({ page }) => {
  await page.getByLabel(/language|idioma/i).selectOption('pt-BR')
})

When('I reload the settings screen', async ({ page }) => {
  await page.reload()
  await expect(page.getByRole('main')).toBeVisible()
})

When('I set {word} to {int} hours', async ({ page }, weekday: string, hours: number) => {
  const field = page.getByLabel(weekday.slice(0, 3), { exact: false })

  await field.fill(String(hours))
  await field.blur()
})

When('I switch the colour scheme', async ({ page }) => {
  await page.getByRole('button', { name: /switch to the (dark|light)/i }).click()
})

Then('the settings screen is in Portuguese', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Configurações' })).toBeVisible()
  await expect(page.getByText('Horas por dia da semana')).toBeVisible()
})

Then('{word} is reported as invalid', async ({ page }, weekday: string) => {
  const field = page.getByLabel(weekday.slice(0, 3), { exact: false })

  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText(/Enter between 0 and 24 hours/i)).toBeVisible()
})

Then(
  'the week strip names {word} against a {int} hour target',
  async ({ page }, weekday: string, hours: number) => {
    await expect(
      page.getByRole('button', {
        name: new RegExp(`${weekday.slice(0, 3)}: .* ${String(hours)} hour target`, 'i'),
      }),
    ).toBeVisible()
  },
)

Then('the page is in the dark colour scheme', async ({ page }) => {
  await expect(page.locator('html')).toHaveClass(/dark/)
})

Given('my browser prefers Brazilian Portuguese', async ({ page }) => {
  // Paraglide resolves the language from `navigator.languages` when nothing has
  // been chosen. The browser context's locale is fixed per project, so the
  // preference is simulated where the app reads it.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt'] })
    Object.defineProperty(navigator, 'language', { get: () => 'pt-BR' })
  })
  await stubTimelogs(page)
})

When('I choose the Tokyo time zone', async ({ page }) => {
  await page.getByLabel(/time zone|fuso/i).selectOption('Asia/Tokyo')
})

Then('the dashboard is in Portuguese', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Painel' })).toBeVisible()
  await expect(page.getByText(/atualizado com o gitlab/i)).toBeVisible()
})

Then('the date reads as Portuguese writes it', async ({ page }) => {
  // "segunda-feira, 24 de agosto de 2026" — the weekday first, "de" between the
  // parts. The hyphen is not optional: five of the seven Portuguese weekdays
  // carry one, and a `\p{L}+` weekday passed this only on a Saturday or a
  // Sunday. It ran on a Sunday for a week and looked green.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /^[\p{L}-]+, \d{1,2} de \p{L}+ de \d{4}$/u,
  )
})

Then('the hours read with a comma', async ({ page }) => {
  // Today's figure is fractional on purpose, so the separator is visible: a
  // comma in Portuguese where English writes a point.
  await expect(page.getByRole('group', { name: /^hoje$/i })).toContainText('6,5')
})

Then('the document declares pt-BR', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
})

Then('the week strip is regrouped for Tokyo', async ({ page }) => {
  // Midday UTC is the evening in Tokyo, still the same day; an entry at 15:00Z
  // stays put, so what changes is which day "today" is when the zones differ.
  await expect(page.locator('button[aria-current="date"]')).toBeVisible()
  await expect(page.getByRole('region', { name: /this week|esta semana/i })).toBeVisible()
})
