import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { readerDay } from '../support/gitlab-api'

const { Then, When } = createBdd()

const MONTH_LENGTH = 'YYYY-MM'.length

/** The languages the suite may meet the app in. */
const LOCALES = ['en-US', 'pt-BR']

/**
 * The first period figure on the dashboard, which is the chosen day's.
 *
 * Named by the date it covers once it is not today, and that name is the
 * reader's locale writing a short date — so it is found by position rather than
 * by a name this step would have to format the same way.
 */
function chosenDay(page: Page) {
  return page.getByRole('main').getByRole('group').first()
}

/** The first day of the month `monthsBack` before the reader's current one, as `YYYY-MM`. */
function monthBefore(monthsBack: number): string {
  const [year = 0, month = 1] = readerDay(0).split('-').map(Number)
  const moved = new Date(Date.UTC(year, month - 1 - monthsBack, 1))

  return moved.toISOString().slice(0, MONTH_LENGTH)
}

/** The month's heading in any language the suite may meet, as one pattern. */
function monthHeading(param: string): RegExp {
  const first = new Date(`${param}-01T12:00:00Z`)
  const names = LOCALES.map((locale) =>
    new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC', year: 'numeric' }).format(
      first,
    ),
  )

  return new RegExp(`^(${names.join('|')})$`, 'iu')
}

async function settled(page: Page): Promise<void> {
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
}

When('I step the dashboard back one day', async ({ page }) => {
  await page.getByRole('button', { name: /previous day|dia anterior/iu }).click()
  await expect(page).toHaveURL(/[?&]date=/u)
})

When('I pick yesterday from the day picker', async ({ page }) => {
  const yesterday = new Date(`${readerDay(1)}T12:00:00Z`)
  // The calendar names each day as the app's headings do, so the step matches
  // that wording in either language rather than formatting it one way.
  const names = LOCALES.map((locale) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
      weekday: 'long',
      year: 'numeric',
    }).format(yesterday),
  )

  await page.getByRole('button', { name: /^(day shown|dia exibido): /iu }).click()
  // On the first of a month yesterday is the previous month's last day, drawn
  // among the outside days of this month's grid.
  await page
    .getByRole('grid')
    .getByRole('button', { name: new RegExp(`^(${names.join('|')})`, 'iu') })
    .click()
  await expect(page).toHaveURL(/[?&]date=/u)
})

When('I reload the dashboard as of {int} days ago', async ({ page }, days: number) => {
  await page.goto(`/?date=${readerDay(days)}`)
  await settled(page)
})

When(
  'I open the dashboard at an address naming the day {string}',
  async ({ page }, day: string) => {
    await page.goto(`/?date=${encodeURIComponent(day)}`)
    await settled(page)
  },
)

When('I go back to today', async ({ page }) => {
  await page.getByRole('button', { name: /back to today|voltar para hoje/iu }).click()
})

When('I step insights back one month', async ({ page }) => {
  await page.getByRole('button', { name: /previous month|mês anterior/iu }).click()
  await settled(page)
})

When('I reload insights for the month of {int} days ago', async ({ page }, days: number) => {
  await page.goto(`/insights?month=${readerDay(days).slice(0, MONTH_LENGTH)}`)
  await settled(page)
})

When('I go back to the current month', async ({ page }) => {
  await page
    .getByRole('button', { name: /back to the current month|voltar para o mês atual/iu })
    .click()
  await settled(page)
})

Then('the chosen day reads {float} hours', async ({ page }, hours: number) => {
  await expect(chosenDay(page)).not.toHaveAccessibleName(/^(today|hoje)$/iu)
  await expect(chosenDay(page)).toContainText(String(hours))
})

Then('the address names yesterday', async ({ page }) => {
  await expect(page).toHaveURL(new RegExp(`[?&]date=${readerDay(1)}$`, 'u'))
})

Then('the address names no day', async ({ page }) => {
  await expect(page).not.toHaveURL(/[?&]date=/u)
})

Then('insights names the month before this one', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(monthHeading(monthBefore(1)))
})

Then('insights names the current month', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(monthHeading(monthBefore(0)))
})

Then('the address names the month before this one', async ({ page }) => {
  await expect(page).toHaveURL(new RegExp(`[?&]month=${monthBefore(1)}$`, 'u'))
})

Then('the address names no month', async ({ page }) => {
  await expect(page).not.toHaveURL(/[?&]month=/u)
})

Then('the split by project holds {float} hours', async ({ page }, hours: number) => {
  const split = page.getByRole('region', { name: /hours by project|horas por projeto/iu })

  await expect(split.getByRole('listitem').first()).toContainText(String(hours))
})
