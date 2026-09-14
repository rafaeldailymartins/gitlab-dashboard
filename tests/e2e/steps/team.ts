import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { ANA, BRUNO, HIDDEN_HOURS, stubGroupHours } from '../support/gitlab-groups'

const { Given, Then, When } = createBdd()

const DAYS_IN_MAY = 31

Given('the group {string} has hours logged in it', async ({ page }, _group: string) => {
  await stubGroupHours(page)
})

Given('I am a Guest in that group, and GitLab is holding hours back', async ({ page }) => {
  await stubGroupHours(page, {
    access: { integerValue: 10, stringValue: 'GUEST' },
    hidden: HIDDEN_HOURS * 3600,
  })
})

When(
  'I open the team report for {string} in {string}',
  async ({ page }, group: string, month: string) => {
    await page.goto(`/team?group=${encodeURIComponent(group)}&month=${month}&by=days`)
    await expect(page.getByRole('main')).toBeVisible()
    // The matrix arrives after the roster and the first page of entries; waiting
    // for a row is what makes the assertions that follow mean what they say.
    await expect(page.getByRole('rowheader', { name: ANA.name })).toBeVisible()
  },
)

When('I open the team report with no group named', async ({ page }) => {
  await page.goto('/team')
  await expect(page.getByRole('main')).toBeVisible()
})

When('I open the group picker', async ({ page }) => {
  await page.getByRole('combobox', { name: /group|grupo/iu }).click()
})

When('I switch the columns to weeks', async ({ page }) => {
  await page.getByRole('button', { name: /weeks|semanas/i }).click()
})

When('I order the rows by total', async ({ page }) => {
  await page.getByRole('button', { name: /^total$/i }).click()
})

Then('the report is headed {string}', async ({ page }, name: string) => {
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
})

Then('the month shown is May 2026', async ({ page }) => {
  await expect(page.getByText(/may 2026|maio de 2026/i).first()).toBeVisible()
})

Then('the screen says the figures cover the group and its subgroups', async ({ page }) => {
  // Twice, deliberately. The subtitle is what a reader looking at the page
  // sees; the caption is what a reader who jumps straight to the table hears,
  // and an empty cell is only honest because that caption qualifies it.
  await expect(page.getByText(/subgroups|subgrupos/iu).first()).toBeVisible()
  await expect(page.locator('caption')).toContainText(/subgroups|subgrupos/iu)
})

Then('the table has a row heading for {string}', async ({ page }, name: string) => {
  await expect(page.getByRole('rowheader', { name })).toBeVisible()
})

Then('the table has a column heading for every day of the month', async ({ page }) => {
  // The second header row is the days. The first holds the two corners, which
  // span both rows, and one band per ISO week — all of which are column headers
  // too, so counting every `columnheader` on the page would count those as days.
  const days = page.locator('thead tr').nth(1).getByRole('columnheader')

  await expect(days).toHaveCount(DAYS_IN_MAY)
})

/**
 * A month of a team is over a thousand cells.
 *
 * Making each one a stop would put everything after the table dozens of presses
 * away, so the reader tabs to the region and reads inside it with the table keys
 * their screen reader already gives them.
 */
Then('no cell of the table is a keyboard stop', async ({ page }) => {
  const focusable = page.locator('td [tabindex="0"], td a, td button')

  await expect(focusable).toHaveCount(0)
})

/**
 * Asserted after the note, never before it.
 *
 * Nobody is dropped until the month has been read, so a check for an absent row
 * that ran while the pages were still arriving would pass on a row that had not
 * rendered yet. The note is drawn from the same completion, which makes it the
 * thing to wait for.
 */
Then('the table has no row for {string}', async ({ page }, name: string) => {
  // Waited on first: nobody is dropped until the month has been read, so this
  // would otherwise pass against a row that had not arrived yet.
  await expect(page.getByRole('status')).not.toContainText(/still reading|ainda lendo/iu)
  await expect(page.getByRole('rowheader', { name: new RegExp(name, 'iu') })).toHaveCount(0)
})

/**
 * The screen sees one group. "Nobody logged anything" is not a claim it can
 * support, so no sentence on it may make one — not in a cell, not under the
 * table, not in the key.
 */
Then('nothing on the screen says anybody logged nothing', async ({ page }) => {
  await expect(
    page.getByText(/logged nothing|logged no (time|hours)|não lançou|sem lançamentos/iu),
  ).toHaveCount(0)
})

/**
 * The mark, in the cell, spoken.
 *
 * Read through the sentence rather than the bracketed figure: the brackets are
 * `aria-hidden`, and what a reader who cannot see them gets is the sentence.
 * Asserting the thing everybody receives is the point of running this in a
 * browser at all.
 */
/**
 * 6.5 h arrived and 2.5 h did not, and the row shows 9 — the provider's own
 * total. Nothing distinguishes the part that cannot be opened: that was tried
 * twice, as a bracketed figure and as a spoken sentence, and taken out both
 * times. The screen shows the truer number and says nothing more.
 */
Then(
  'the row for {string} totals {string} hours',
  async ({ page }, name: string, hours: string) => {
    const row = page.getByRole('row').filter({ hasText: name })

    // The total is the last cell of the row, pinned to the right edge.
    await expect(row.locator('td').last()).toContainText(hours)
  },
)

/**
 * What an empty cell says, read the way a screen reader receives it.
 *
 * The subtitle that qualifies the scope sits in the page header, and a reader
 * who reaches the grid by landmark or by table navigation never passes it. So
 * the cell has to carry the qualification itself, and this asserts the text
 * rather than the dash beside it.
 */
Then('an empty working day is spoken as holding no hours in this group', async ({ page }) => {
  await expect(
    page.getByText(/no hours in this group|nenhuma hora neste grupo/iu).first(),
  ).toBeAttached()
})

Then('no cell claims that anybody logged nothing at all', async ({ page }) => {
  // The exact sentence this screen used to make, from one group's worth of
  // evidence, about a whole person's month.
  await expect(page.getByText(/^no time logged.$|^nenhuma hora lançada.$/iu)).toHaveCount(0)
})

/**
 * A key for a mark that is nowhere in the table is worse than no key: the
 * reader scans for it and finds nothing. Withheld hours are rare, so a
 * permanent entry for them would mostly be a permanent false lead.
 */
Then('the legend does not explain a mark the table has none of', async ({ page }) => {
  // Nobody in this fixture went past the reference, so the key must not offer
  // to explain what going past it looks like.
  await expect(page.getByText(/over the reference|acima da referência/iu)).toHaveCount(0)
})

/**
 * The one region this control owns says when the hours arrived, whether they
 * are arriving now, and whether asking failed. What a figure could not include
 * is said beside that figure, on the row it belongs to.
 */
Then('the sync control says only when the hours arrived', async ({ page }) => {
  const status = page.getByRole('status')

  await expect(status).toHaveText(/updated|updating|atualizad/iu)
  await expect(status).not.toHaveText(/guest|did not show|não mostrou/iu)
})

Then('the legend states the reference the bars are measured against', async ({ page }) => {
  await expect(page.getByText(/measured against|medidas contra/i)).toBeVisible()
})

/**
 * Completed by redirecting, not by filling the screen in behind the address:
 * what a reader is looking at has to be what they can send somebody else.
 */
Then('the address names {string}', ({ page }, group: string) => {
  // Read as a parameter rather than matched against the whole URL: a group
  // path is full of slashes, and escaping it into a pattern is a way to be
  // wrong about what the test asserts.
  expect(new URL(page.url()).searchParams.get('group')).toBe(group)
})

Then('the address says the columns are weeks', async ({ page }) => {
  await expect(page).toHaveURL(/by=weeks/)
})

Then('the total heading reports the ordering', async ({ page }) => {
  const heading = page.getByRole('columnheader', { name: /total/i })

  await expect(heading).toHaveAttribute('aria-sort', /ascending|descending/)
})

Then('the screen asks me to choose a group', async ({ page }) => {
  await expect(page.getByText(/choose a group|escolha um grupo/i)).toBeVisible()
})

Then('the picker offers {string}', async ({ page }, name: string) => {
  await expect(page.getByRole('option', { name: new RegExp(name, 'iu') })).toBeVisible()
})

/**
 * The reader's own hours are kept on the device so a return visit paints at
 * once. A group's belong to other people, and a shared machine must not keep
 * them.
 */
Then('nothing about the group is written to the device', async ({ page }) => {
  const stored = await page.evaluate(async () => {
    const databases = await indexedDB.databases()
    const names = databases.map((database) => database.name ?? '')

    return { names, storage: JSON.stringify(localStorage) }
  })

  expect(stored.storage).not.toContain(BRUNO.name)
  expect(stored.storage).not.toContain('group-timelogs')
})
