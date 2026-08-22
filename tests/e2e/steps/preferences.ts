import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Then, When } = createBdd()

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
