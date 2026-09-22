import { expect, type Locator, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { FISCAL_TEAM } from '../support/teams-api'

const { Then, When } = createBdd()

/**
 * Every locator below is scoped to the part of the dialog it reads.
 *
 * The same person can stand in two of them at once — somebody on the team is
 * also a search result the moment the reader types their name — so the scope is
 * what makes "the team lists them" a different claim from "the search found
 * them", rather than two names for the one match that happens to be on screen.
 */

/** The report the dialog opens over. It is addressed; the dialog is not. */
const REPORT = `/team?team=${FISCAL_TEAM.id}&month=2026-05&by=days`

/** The dialog's own landmark, in either language. */
const TITLE = /^teams$|^equipes$/iu

function dialog(page: Page): Locator {
  return page.locator('[data-slot="dialog-content"]')
}

function members(page: Page): Locator {
  return page.getByRole('region', { name: /people on this team|pessoas nesta equipe/iu })
}

function nameField(page: Page): Locator {
  return page.getByRole('textbox', { name: /team name|nome da equipe/iu })
}

/** Waits for the dialog and its title, whichever screen opened it. */
async function opened(page: Page): Promise<void> {
  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page).getByText(TITLE).first()).toBeVisible()
}

function searchResults(page: Page): Locator {
  return page.getByRole('region', { name: /add anybody by name|adicionar qualquer pessoa/iu })
}

function teamChooser(page: Page): Locator {
  return page.getByRole('group', { name: /your teams|suas equipes/iu })
}

When('I open my teams', async ({ page }) => {
  await page.goto(REPORT)
  await page
    .getByRole('button', { name: /manage teams|gerenciar equipes/iu })
    .first()
    .click()
  await opened(page)
})

/**
 * A reload rather than a second click, and it stands in for the second device:
 * the teams query carries `persist: false`, so nothing of it survives the page —
 * whatever paints after this came back from the store.
 */
When('I open my teams again', async ({ page }) => {
  await page.reload()
  await page
    .getByRole('button', { name: /manage teams|gerenciar equipes/iu })
    .first()
    .click()
  await opened(page)
})

/**
 * The same dialog, without going anywhere first.
 *
 * The one step that proves the surface is a dialog rather than a screen: it is
 * opened from the report the reader is already reading, and closing it leaves
 * them on it.
 */
When('I open my teams from the report', async ({ page }) => {
  await page
    .getByRole('button', { name: /manage teams|gerenciar equipes/iu })
    .first()
    .click()
  await opened(page)
})

When('I start a new team', async ({ page }) => {
  await page.getByRole('button', { name: /^new team$|^nova equipe$/iu }).click()
  await page.getByRole('button', { name: /start an empty team|começar uma equipe vazia/iu }).click()
  // Waited on, because nothing here is applied optimistically: until the store
  // answers, the new team is not in the list and the dialog is still showing the
  // one before it. Typing a name before this lands renames that team instead.
  await expect(nameField(page)).toHaveValue(/^new team$|^nova equipe$/iu)
})

When('I name it {string}', async ({ page }, name: string) => {
  // Enter, because the field commits on Enter or on leaving it — a name is typed
  // a letter at a time and this is the one control that is not saved per stroke.
  await nameField(page).fill(name)
  await nameField(page).press('Enter')
})

/**
 * The whole of the fast path: one group named, one team built.
 *
 * This used to be a combobox followed by a plus beside each person. The step is
 * one click now because the surface is, which is the point of the change and not
 * an incidental tidying of the test.
 */
When('I build a team from the group {string}', async ({ page }, group: string) => {
  await page.getByRole('button', { name: /^new team$|^nova equipe$/iu }).click()
  await page.getByRole('button', { name: new RegExp(group, 'iu') }).click()
  await expect(nameField(page)).toHaveValue(new RegExp(group, 'iu'))
})

When('I add the group {string} to this team', async ({ page }, group: string) => {
  await page.getByRole('button', { name: /add from a group|adicionar de um grupo/iu }).click()
  await page.getByRole('button', { name: new RegExp(group, 'iu') }).click()
  await expect(nameField(page)).toBeVisible()
})

When('I look for {string} by name', async ({ page }, typed: string) => {
  const field = searchResults(page).getByRole('searchbox', {
    name: /search gitlab for a person|buscar uma pessoa/iu,
  })

  await field.fill(typed)
})

When('I add {string} from the search results', async ({ page }, name: string) => {
  const add = new RegExp(`^(add|adicionar) ${name}$`, 'iu')

  await searchResults(page).getByRole('button', { name: add }).click()
  // The list re-renders without them once the store has the change; waiting for
  // that is what keeps the next step from racing the write it depends on.
  await expect(members(page).getByText(name, { exact: true })).toBeVisible()
})

When('I take {string} off the team', async ({ page }, name: string) => {
  const remove = new RegExp(`^(remove|remover) ${name}$`, 'iu')

  await members(page).getByRole('button', { name: remove }).click()
})

When('I close my teams', async ({ page }) => {
  await page.getByRole('button', { name: /^close$|^fechar$/iu }).click()
  await expect(dialog(page)).toHaveCount(0)
})

/**
 * Read off the member list, never off the whole dialog.
 *
 * A name in here is a search result or a member, and only the second of those is
 * the team. Matched exactly, so the span that carries the name is the one match
 * and the `@handle` beside it is not a second one.
 */
Then('the team lists {string}', async ({ page }, name: string) => {
  await expect(members(page).getByText(name, { exact: true })).toBeVisible()
})

Then('the team does not list {string}', async ({ page }, name: string) => {
  await expect(members(page).getByText(name, { exact: true })).toHaveCount(0)
})

/**
 * Once, counted rather than merely found.
 *
 * A duplicate row is the one way this list can produce a wrong figure — the
 * report would count that person's hours twice in every total — and a check that
 * only asked whether they were there would pass on two of them.
 */
Then('the team lists {string} once', async ({ page }, name: string) => {
  await expect(members(page).getByText(name, { exact: true })).toHaveCount(1)
})

Then('the search offers {string}', async ({ page }, name: string) => {
  const add = new RegExp(`^(add|adicionar) ${name}$`, 'iu')

  await expect(searchResults(page).getByRole('button', { name: add })).toBeVisible()
})

Then('I keep the teams {string} and {string}', async ({ page }, first: string, second: string) => {
  await expect(teamChooser(page).getByRole('button', { name: first })).toBeVisible()
  await expect(teamChooser(page).getByRole('button', { name: second })).toBeVisible()
})

/**
 * No chooser at all, rather than an empty one.
 *
 * The group of team buttons is not rendered when there are no teams, so its
 * absence is the assertion. A list the dialog cannot vouch for would be a list
 * with buttons in it.
 */
Then('no team is listed', async ({ page }) => {
  await expect(teamChooser(page)).toHaveCount(0)
})

/**
 * The header is the signed-in chrome, and it belongs to the layout the session
 * guard decides. Its presence is the session, not a claim about one.
 */
Then('I am still signed in', async ({ page }) => {
  await expect(page.getByRole('button', { name: /sign out|sair/iu })).toBeVisible()
})
