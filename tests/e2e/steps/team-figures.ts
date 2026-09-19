import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Then } = createBdd()

const DAYS_IN_MAY = 31

/**
 * The four things an empty working day can say, in either language.
 *
 * Named rather than inlined because each one is asserted twice — once where it
 * belongs and once where it must not appear — and a pattern typed out a second
 * time is a pattern that can drift from its own negative. Which sentence a cell
 * gets is decided by two independent facts: how far the figures reach, and
 * whether this row was shown everything the provider counted. Both of those
 * weaken what may be claimed, and they compose, which is why there are four
 * sentences rather than two.
 */
const LOGGED_NOTHING_ANYWHERE = /no hours logged anywhere|nenhuma hora lançada em lugar nenhum/iu
const LOGGED_NOTHING_IN_GROUP = /no hours in this group|nenhuma hora neste grupo/iu
const UNREADABLE_ANYWHERE = /nothing here that you can read|nada aqui que você possa ler/iu
const UNREADABLE_IN_GROUP =
  /nothing in this group that you can read|nada neste grupo que você possa ler/iu

/** What the key calls that same mark, under each of the two reaches. */
const KEY_ANYWHERE = /working day, nothing logged anywhere|dia útil, nada lançado em lugar nenhum/iu
const KEY_IN_GROUP = /working day, nothing in this group|dia útil, nada neste grupo/iu

/**
 * An hour figure, in either language.
 *
 * The separator is a character class because `Intl` decides it: the same report
 * reads "6.5 h" for a reader in English and "6,5 h" for one in Brazilian
 * Portuguese, and a literal would assert the runner's locale rather than the
 * figure.
 */
function figure(hours: string): RegExp {
  return new RegExp(hours.replaceAll('.', '[.,]'), 'u')
}

/** One person's row, found by the name in its heading. */
function rowFor(page: Page, name: string) {
  return page.getByRole('row').filter({ hasText: name })
}

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
 * A row's total, read off the cell pinned to the right edge.
 *
 * Where hours were withheld this is the provider's own figure for the person
 * rather than the sum of what arrived: `model/withheld.ts` adds the difference
 * into the day it was logged on, so the row, its columns and the corner all
 * still agree. Nothing on screen distinguishes the part that cannot be opened —
 * that was tried as a bracketed figure and as a spoken sentence and taken out
 * both times.
 */
Then(
  'the row for {string} totals {string} hours',
  async ({ page }, name: string, hours: string) => {
    await expect(rowFor(page, name).locator('td').last()).toContainText(figure(hours))
  },
)

/**
 * Nothing stands in for a month nobody has read yet.
 *
 * Asserted as the absence of a table rather than as the absence of a sentence:
 * a negative read against a screen with no grid on it would pass however the
 * grid was drawn once it arrived, which is exactly the assertion this suite
 * used to make about a person's missing row.
 */
Then('space is reserved where the figures go, and no figure is drawn', async ({ page }) => {
  await expect(page.locator('[data-slot="skeleton"]').first()).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})

/**
 * What an empty cell says, read the way a screen reader receives it.
 *
 * The sentence under the heading that states the reach sits in the page header,
 * and a reader who reaches the grid by landmark or by table navigation never
 * passes it. So the cell carries the claim itself, and this asserts the text
 * rather than the dash beside it — the dash is `aria-hidden`, and a reader who
 * cannot see it gets the sentence and nothing else.
 *
 * Unnarrowed, the claim is the strongest this screen has ever made: the figures
 * cover everywhere the provider counts, so a day with nothing in it is a day
 * that person logged nothing at all.
 */
Then('an empty working day is spoken as no hours logged anywhere', async ({ page }) => {
  await expect(page.getByText(LOGGED_NOTHING_ANYWHERE).first()).toBeAttached()
})

Then('an empty working day is spoken as holding no hours in this group', async ({ page }) => {
  await expect(page.getByText(LOGGED_NOTHING_IN_GROUP).first()).toBeAttached()
})

/**
 * What a day says in a row the provider did not show everything of.
 *
 * This row is short by an entry count and no per-column answer survived its
 * checks, so even "nothing here" is known to be understated: the reader is
 * being shown less than the provider counted, and which day the rest belongs to
 * is exactly what could not be established. A cell that went on saying the
 * person logged nothing would be vouching for a month it has already been told
 * it cannot see all of.
 *
 * Two of these, because that weakening does not replace the reach — it composes
 * with it. Whatever this row may still claim, it may not claim it any wider than
 * the reader's own filter allows.
 */
Then(
  'an empty day in the row for {string} is spoken as nothing here that can be read',
  async ({ page }, name: string) => {
    await expect(rowFor(page, name).getByText(UNREADABLE_ANYWHERE).first()).toBeAttached()
  },
)

Then(
  'an empty day in the row for {string} is spoken as nothing in this group that can be read',
  async ({ page }, name: string) => {
    await expect(rowFor(page, name).getByText(UNREADABLE_IN_GROUP).first()).toBeAttached()
  },
)

/**
 * Neither claim, in either reach, anywhere in that row.
 *
 * The sentences above exist to replace these, so a row carrying both would be
 * saying two incompatible things about the same day — and the one that is wrong
 * is the one a reader is most likely to act on, because "logged nothing" is the
 * only sentence here that sounds like a finding.
 *
 * Scoped to the row rather than to the page, deliberately. Every other row in
 * this report was shown everything the provider counted and is entitled to say
 * the person logged nothing; a page-wide check would fail on Bruno for being
 * right.
 */
Then('no cell in the row for {string} says they logged nothing', async ({ page }, name: string) => {
  const row = rowFor(page, name)

  await expect(row.getByText(LOGGED_NOTHING_ANYWHERE)).toHaveCount(0)
  await expect(row.getByText(LOGGED_NOTHING_IN_GROUP)).toHaveCount(0)
})

/**
 * Kept from the report this screen replaces, because the claim it forbids is
 * still forbidden wherever a group is named: an hour logged on an issue in
 * another group is not missing from the answer, it was never asked for.
 *
 * Two sentences rather than one. The first is the exact wording the original
 * bug shipped with, kept so a revert cannot pass; the second is how the same
 * claim is phrased today, and is the one a narrowed report could reach by
 * forgetting the reader's own filter.
 */
Then('no cell claims that anybody logged nothing at all', async ({ page }) => {
  await expect(page.getByText(/^no time logged\.$|^nenhuma hora lançada\.$/iu)).toHaveCount(0)
  await expect(page.getByText(LOGGED_NOTHING_ANYWHERE)).toHaveCount(0)
})

Then('the row for {string} says GitLab did not recognise them', async ({ page }, name: string) => {
  await expect(rowFor(page, name).getByText(/did not recognise|não reconheceu/iu)).toBeVisible()
})

/**
 * Every cell of an unresolved person's row, counted rather than sampled.
 *
 * An absent answer is not an answer of zero, so no day of it may read as a day
 * they failed to log. Counting all thirty-one is what makes this a claim about
 * the row: a `toBeAttached` on the first one would pass on a row of one such
 * cell and thirty dashes.
 */
Then('every cell of the row for {string} says nothing is known', async ({ page }, name: string) => {
  const row = rowFor(page, name)

  await expect(row.getByText(/nothing is known|nada se sabe/iu)).toHaveCount(DAYS_IN_MAY)
  await expect(row.getByText(LOGGED_NOTHING_ANYWHERE)).toHaveCount(0)
})

/** The corner: what the whole team logged, and so what an absent answer did not add to. */
Then('the team total is still {string} hours', async ({ page }, hours: string) => {
  await expect(page.locator('tfoot th').last()).toContainText(figure(hours))
})

Then('the legend states the reference the bars are measured against', async ({ page }) => {
  await expect(page.getByText(/measured against|medidas contra/iu)).toBeVisible()
})

/**
 * The key follows the reader's filter, exactly as the cells do.
 *
 * Cited against GROUP-5 rather than GROUP-11 because that is what the spec text
 * supports: GROUP-11 is about what the bars are measured against and about a key
 * listing only the marks the table actually uses, and says nothing about reach
 * at all. GROUP-5 is where what may be claimed about an empty day is tied to how
 * far the figures reach — including its insistence that the two be different
 * sentences rather than one sentence qualified elsewhere on the page, which is
 * precisely what a key is.
 *
 * Each direction asserts the other's absence. A key is read as the authority on
 * what a mark means, so one making the wider claim under a narrowed report would
 * outrank the cells that were split in two to avoid making it — and a reader who
 * consulted it would come away with the filter's effect reported as a
 * colleague's behaviour.
 */
Then('the key explains the empty-day mark as nothing logged anywhere', async ({ page }) => {
  await expect(page.getByText(KEY_ANYWHERE)).toBeVisible()
  await expect(page.getByText(KEY_IN_GROUP)).toHaveCount(0)
})

Then('the key explains the empty-day mark as nothing in this group', async ({ page }) => {
  await expect(page.getByText(KEY_IN_GROUP)).toBeVisible()
  await expect(page.getByText(KEY_ANYWHERE)).toHaveCount(0)
})

/**
 * A key for a mark that is nowhere in the table is worse than no key: the
 * reader scans for it and finds nothing. Nobody in this fixture went past the
 * reference, so the key must not offer to explain what going past it looks like.
 */
Then('the legend does not explain a mark the table has none of', async ({ page }) => {
  await expect(page.getByText(/over the reference|acima da referência/iu)).toHaveCount(0)
})

Then('the total heading reports the ordering', async ({ page }) => {
  const heading = page.getByRole('columnheader', { name: /total/iu })

  await expect(heading).toHaveAttribute('aria-sort', /ascending|descending/u)
})
