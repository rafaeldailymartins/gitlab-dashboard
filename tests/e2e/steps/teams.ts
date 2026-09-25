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
  // Still waited on, for a different reason than before. It used to be that
  // nothing was optimistic and the team was not in the list until the store
  // answered; edits are collected now, so the wait is on the pane following the
  // new team rather than on a round trip. Typing a name before it lands still
  // renames the team that was showing.
  await expect(nameField(page)).toHaveValue(/^new team$|^nova equipe$/iu)
})

/**
 * Writes everything edited since the dialog was opened.
 *
 * Waits for the write to have resolved, not for it to have succeeded — three
 * scenarios press this precisely to be refused. What the save said is the next
 * step's to assert; what this needs is that it is no longer in flight, so a
 * reload after it is a reload after the store heard.
 */
When('I save my teams', async ({ page }) => {
  await dialog(page)
    .getByRole('button', { name: /^save$|^salvar$/iu })
    .click()
  await expect(page.getByRole('status')).not.toHaveText(/^saving|^salvando/iu)
})

/** Throws them away. Nothing was stored, so there is nothing to undo. */
When('I discard my teams', async ({ page }) => {
  await dialog(page)
    .getByRole('button', { name: /^cancel$|^cancelar$/iu })
    .click()
})

When('I name it {string}', async ({ page }, name: string) => {
  // No Enter any more. The field used to commit on Enter or on leaving it,
  // because a save per letter was a write per letter; every letter goes into
  // what is being edited now, and only saving reaches the store.
  await nameField(page).fill(name)
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
  await dialog(page)
    .getByRole('button', { name: /^close$|^fechar$/iu })
    .click()
  await expect(dialog(page)).toHaveCount(0)
})

/** Tries to close, which is refused while anything is unsaved. */
When('I try to close my teams', async ({ page }) => {
  await dialog(page)
    .getByRole('button', { name: /^close$|^fechar$/iu })
    .click()
})

/**
 * Located by the choice it offers, not by its sentence.
 *
 * The footer says "Not saved yet" while anything is unsaved, and the question
 * says the changes are not saved — one regex over the dialog's text matches
 * both, which is a strict-mode violation rather than a useful assertion. The
 * way out of the question is unambiguous, and it is also the thing being
 * claimed: the reader was given one.
 */
Then('I am asked about the changes I did not save', async ({ page }) => {
  await expect(dialog(page)).toHaveCount(1)
  await expect(
    dialog(page).getByRole('button', { name: /keep editing|continuar editando/iu }),
  ).toBeVisible()
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
