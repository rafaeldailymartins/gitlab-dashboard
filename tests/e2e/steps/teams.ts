import { expect, type Locator, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Then, When } = createBdd()

/**
 * Every locator below is scoped to the section it reads.
 *
 * The editor has three, each named by a heading, and each offers to put somebody
 * on the team or take them off. The same person can stand in two of them at
 * once — Diego is a suggestion from the group and a search result at the same
 * moment — so the scope is what makes "the suggestions offer him" a different
 * claim from "the search does", rather than two names for the one button that
 * happens to be the only one on screen.
 */

/** The screen's own landmark, in either language. */
const HEADING = /^teams$|^equipes$/iu

/**
 * The control that puts one person on the team, wherever they are offered.
 *
 * Anchored, because "Add Ana" is a prefix of "Add Ana Carolina" and a check for
 * an absent name that is left loose is how one starts passing against another.
 */
function addButton(within: Locator, name: string): Locator {
  return within.getByRole('button', { name: new RegExp(`^(add|adicionar) ${name}$`, 'iu') })
}

function members(page: Page): Locator {
  return page.getByRole('region', { name: /people on this team|pessoas nesta equipe/iu })
}

function nameField(page: Page): Locator {
  return page.getByRole('textbox', { name: /team name|nome da equipe/iu })
}

function searchResults(page: Page): Locator {
  return page.getByRole('region', { name: /add anybody by name|adicionar qualquer pessoa/iu })
}

function suggestions(page: Page): Locator {
  return page.getByRole('region', { name: /suggest people from a group|sugerir pessoas/iu })
}

function teamChooser(page: Page): Locator {
  return page.getByRole('group', { name: /your teams|suas equipes/iu })
}

When('I open the teams screen', async ({ page }) => {
  await page.goto('/teams')
  await expect(page.getByRole('heading', { level: 1, name: HEADING })).toBeVisible()
})

When('I open the teams screen again', async ({ page }) => {
  // A reload rather than a second navigation, and it stands in for the second
  // device: the teams query carries `persist: false`, so nothing of it survives
  // the page — whatever paints after this came back from the store.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: HEADING })).toBeVisible()
})

When('I start a new team', async ({ page }) => {
  await page.getByRole('button', { name: /^new team$|^nova equipe$/iu }).click()
  // Waited on, because nothing here is applied optimistically: until the store
  // answers, the new team is not in the list and the screen is still showing the
  // first one. Typing a name before this lands renames that team instead.
  await expect(nameField(page)).toHaveValue(/^new team$|^nova equipe$/iu)
})

When('I name it {string}', async ({ page }, name: string) => {
  // Enter, because the field commits on Enter or on leaving it — a name is typed
  // a letter at a time and this is the one control that is not saved per stroke.
  await nameField(page).fill(name)
  await nameField(page).press('Enter')
})

When('I look for {string} by name', async ({ page }, typed: string) => {
  const field = searchResults(page).getByRole('searchbox', {
    name: /search gitlab for a person|buscar uma pessoa/iu,
  })

  await field.fill(typed)
})

When('I add {string} from the search results', async ({ page }, name: string) => {
  await addButton(searchResults(page), name).click()
})

/**
 * The same button, in the other section, and the distinction is the point.
 *
 * Adding from the suggestions is how a team gets seeded from a group, which is
 * the only way a reader can end up with somebody on their team because that
 * group once held their hours. Whether the team then follows the group is
 * exactly what GROUP-15 says it must not do, and a scenario that seeded from the
 * search box instead would have nothing to do with the rule.
 */
When('I add {string} from the suggestions', async ({ page }, name: string) => {
  await addButton(suggestions(page), name).click()
  // The list re-renders without them once the store has the change; waiting for
  // that is what keeps the next step from racing the write it depends on.
  await expect(members(page).getByText(name, { exact: true })).toBeVisible()
})

When('I take {string} off the team', async ({ page }, name: string) => {
  const remove = new RegExp(`^(remove|remover) ${name}$`, 'iu')

  await members(page).getByRole('button', { name: remove }).click()
})

When('I suggest people from the group {string}', async ({ page }, group: string) => {
  await page.getByRole('combobox', { name: /group to suggest from|grupo para sugerir/iu }).click()
  await page.getByRole('option', { name: new RegExp(group, 'iu') }).click()
})

/**
 * Read off the member list, never off the whole screen.
 *
 * A name on this screen is a suggestion, a search result or a member, and only
 * the last of those is the team. Matched exactly, so the span that carries the
 * name is the one match and the `@handle` beside it is not a second one.
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

Then('the suggestions offer {string}', async ({ page }, name: string) => {
  await expect(addButton(suggestions(page), name)).toBeVisible()
})

/**
 * Asserted only after somebody else has been offered, which the scenarios do.
 *
 * An empty list is also a list with nobody in it, so this would pass against
 * suggestions that had not arrived yet.
 */
Then('the suggestions do not offer {string}', async ({ page }, name: string) => {
  await expect(addButton(suggestions(page), name)).toHaveCount(0)
})

Then('the search offers {string}', async ({ page }, name: string) => {
  await expect(addButton(searchResults(page), name)).toBeVisible()
})

/**
 * Offered, and said to be inactive — which is two claims and needs both.
 *
 * Offered alone would pass against a fixture whose `state` never reached the
 * screen at all, and so against a rule that had quietly stopped being about
 * anything. The mark is the one thing on screen that could only have come from
 * the provider saying this account is no longer active, so asserting it is what
 * makes the other half of the scenario a fact rather than a coincidence.
 *
 * Read off the person's own entry rather than off the section: a sentence
 * somewhere in the list is not a sentence about them.
 */
Then('the suggestions say {string} is no longer active', async ({ page }, name: string) => {
  const offered = suggestions(page).getByRole('listitem').filter({ hasText: name })

  await expect(offered.getByText(/no longer active|não está mais ativa/iu)).toBeVisible()
})

/**
 * A list of who logged time answers a different question depending on when, and
 * a reader who is not told the window cannot tell an absence from a holiday.
 */
Then('the suggestions say how far back they look', async ({ page }) => {
  await expect(suggestions(page).getByText(/ since | desde /iu)).toBeVisible()
})

Then('I keep the teams {string} and {string}', async ({ page }, first: string, second: string) => {
  await expect(teamChooser(page).getByRole('button', { name: first })).toBeVisible()
  await expect(teamChooser(page).getByRole('button', { name: second })).toBeVisible()
})

/**
 * No chooser at all, rather than an empty one.
 *
 * The group of team buttons is not rendered when there are no teams, so its
 * absence is the assertion. A list the screen cannot vouch for would be a list
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
