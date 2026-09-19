import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import {
  ANA,
  DIEGO,
  HIDDEN_HOURS,
  operationOf,
  stubTeamHours,
  stubUnreadableGroup,
  userNode,
} from '../support/gitlab-teams'
import { FISCAL_TEAM, stubTeamsStore } from '../support/teams-api'

const { Given, Then, When } = createBdd()

/**
 * The provider's one endpoint, again.
 *
 * Declared here rather than imported because a step that holds an answer back
 * or refuses a probe is registering its own route over the fixture's, which is
 * how this suite layers stubs: the later registration sees the request first and
 * hands back what it does not recognise.
 */
const GRAPHQL = '**/api/graphql'

const SECONDS_PER_HOUR = 3600

/**
 * The filter's first option, in either language.
 *
 * Anchored, because this is the entry whose whole name is the word: a loose
 * pattern would also match the group entries, whose accessible name is their
 * name and their path, and the way back would be clicked by matching something
 * that is not it.
 */
const EVERYWHERE = /^(everywhere|em todo lugar)$/iu

/** The combobox that narrows the figures, in either language. */
const FILTER = /narrow to a group|restringir a um grupo/iu

/** The native select that names the team, in either language. */
const TEAM_PICKER = /^team$|^equipe$/iu

/**
 * The answer a scenario is holding, and the way to let it go.
 *
 * Per page rather than per file: Playwright runs the scenarios of one feature in
 * the same worker, and a module-level promise would make one scenario's held
 * answer another scenario's deadlock.
 */
const holding = new WeakMap<Page, () => void>()

/**
 * The report's address, as a link somebody would send.
 *
 * The team travels as the identifier the stubbed store holds, read from the
 * fixture rather than repeated: a literal that drifted from the store would
 * fail as a team this reader does not have, which looks nothing like the wrong
 * address it would be.
 */
function addressOf(month: string, group: string): string {
  const search = new URLSearchParams({ by: 'days', month, team: FISCAL_TEAM.id })

  if (group !== '') {
    search.set('group', group)
  }

  return `/team?${search.toString()}`
}

async function openReport(page: Page, month: string, group: string): Promise<void> {
  await page.goto(addressOf(month, group))
  await expect(page.getByRole('main')).toBeVisible()
  // The matrix arrives after the store names the team and the first round of
  // entries lands. Waiting for a row is what makes the assertions that follow
  // mean what they say rather than pass against a screen still being built.
  await expect(page.getByRole('rowheader', { name: ANA.name })).toBeVisible()
}

/** A person as the teams store keeps them: an identifier, and what to call them. */
function storedMember(person: { name: string; username: string }) {
  return { id: userNode(person).id, name: person.name, username: person.username }
}

Given("GitLab is holding some of my team's hours back", async ({ page }) => {
  await stubTeamHours(page, { hidden: HIDDEN_HOURS * SECONDS_PER_HOUR })
})

/**
 * A probe that resolves nobody, which the placement refuses.
 *
 * `model/withheld.ts` requires the period to declare at least what the row
 * already draws, and an unresolved person declares nothing at all — so the
 * marks are refused and the row goes on saying hours are missing without saying
 * where. That is the only state in which the caveat is on screen at all, and so
 * the only one in which it can be looked for in the wrong place.
 */
/** Every column probe this page has sent, counted from the moment it is armed. */
const probes = new WeakMap<Page, { count: number }>()

/**
 * Watches for the request that asks which day a withheld hour fell on.
 *
 * Registered as its own route so the count is of requests SENT rather than of
 * marks drawn. A placement can also be refused after the asking — by the checks
 * in `model/withheld.ts` — and the two leave the screen looking the same, so an
 * assertion made from the screen could not tell "never asked" from "asked and
 * refused". Only this can.
 */
Given('GitLab is watching for a column probe', async ({ page }) => {
  probes.set(page, { count: 0 })
  await page.route(GRAPHQL, async (route) => {
    if (operationOf(route) === 'TeamColumnProbe') {
      const tally = probes.get(page) ?? { count: 0 }

      tally.count += 1
      probes.set(page, tally)
    }

    await route.fallback()
  })
})

Given('GitLab will not say which day it held them back from', async ({ page }) => {
  await page.route(GRAPHQL, async (route) => {
    if (operationOf(route) !== 'TeamColumnProbe') {
      await route.fallback()

      return
    }

    await route.fulfill({ json: { data: { user: null } } })
  })
})

/**
 * The hours, held until a step lets them go.
 *
 * Only the round that carries the entries waits. The teams store still answers,
 * so the screen knows whose report this is while it has no figure to draw for
 * any of them — which is the state this exists to put a reader in.
 */
Given('GitLab will not answer for my team until I let it', async ({ page }) => {
  const answered = new Promise<void>((resolve) => {
    holding.set(page, resolve)
  })

  await page.route(GRAPHQL, async (route) => {
    if (operationOf(route) === 'TeamHoursPage') {
      await answered
    }

    await route.fallback()
  })
})

Given('the group my link narrows to is one I cannot open', async ({ page }) => {
  await stubUnreadableGroup(page)
})

/**
 * A team naming somebody the provider's answer leaves out.
 *
 * Diego logged time in the group and is not among the people the hours document
 * resolves, so storing him is exactly the case the report has to draw from what
 * the reader last saw: an account gone, blocked, or beyond this reader are
 * indistinguishable from here and all mean the same thing on screen.
 */
Given('my team names somebody GitLab will not resolve', async ({ page }) => {
  await stubTeamsStore(page, {
    teams: [{ ...FISCAL_TEAM, members: [...FISCAL_TEAM.members, storedMember(DIEGO)] }],
  })
})

/**
 * The group's contributors change under a team that was seeded from them.
 *
 * Registered over the fixture rather than beside it, which is how this suite
 * layers a stub: the later route sees the request first. From here the group
 * holds none of their entries — so the suggestions no longer offer them — and
 * the hours document resolves them with an empty month. Resolved, deliberately:
 * a person the provider will not name is GROUP-21's row and says nothing is
 * known, where this one is a colleague the reader chose whose figure is a real
 * zero. If the team followed the group, the row would be gone instead.
 *
 * Diego is the only person a scenario can do this to, because he is the only
 * suggestion who is not already on the reader's team and so the only one a team
 * can be seeded with. Named in the step all the same — a feature that said "the
 * person I seeded" would read as though the fixture could do this to anybody —
 * and checked here, so a scenario naming somebody else fails loudly instead of
 * silently stubbing nothing.
 */
When('{string} stops logging time in that group', async ({ page }, name: string) => {
  expect(name, 'Only Diego can stop logging in this fixture').toBe(DIEGO.name)
  await stubTeamHours(page, { stopped: DIEGO })
})

When('I open the report for my team in {string}', async ({ page }, month: string) => {
  await openReport(page, month, '')
})

When(
  'I open the report for my team in {string}, narrowed to {string}',
  async ({ page }, month: string, group: string) => {
    await openReport(page, month, group)
  },
)

When(
  'I open the report for my team in {string}, before GitLab answers',
  async ({ page }, month: string) => {
    await page.goto(addressOf(month, ''))
    await expect(page.getByRole('main')).toBeVisible()
  },
)

When('I open the report with no team named', async ({ page }) => {
  await page.goto('/team')
  await expect(page.getByRole('main')).toBeVisible()
})

When('GitLab answers', ({ page }) => {
  const answer = holding.get(page)

  expect(answer, 'Nothing is being held back for this page').toBeDefined()
  answer?.()
})

When('I open the group filter', async ({ page }) => {
  await page.getByRole('combobox', { name: FILTER }).click()
  await expect(page.getByRole('listbox')).toBeVisible()
})

When('I choose {string} from the filter', async ({ page }, group: string) => {
  await page
    .getByRole('listbox')
    .getByRole('option', { name: new RegExp(group, 'iu') })
    .click()
  // The choice travels through the address and every figure below is read under
  // it, so anything asserted before the address moves is asserted against the
  // report the reader was already looking at.
  await expect(page).toHaveURL(/group=/u)
})

/**
 * The same journey back, which is a different click and not the same one undone.
 *
 * The way back is an option like any other — a group whose path is empty, which
 * is what "no group" is everywhere else in this app — so clearing takes the
 * route choosing takes. Waiting on the address is the mirror of the step above,
 * and for the same reason: an address still carrying a group is a screen still
 * showing the narrowed figures, and a total read there would be the one this
 * scenario exists to prove it stopped showing.
 */
When('I choose the way back to everywhere', async ({ page }) => {
  await page.getByRole('listbox').getByRole('option', { name: EVERYWHERE }).click()
  await expect(page).not.toHaveURL(/group=[^&]/u)
})

When('I switch the columns to weeks', async ({ page }) => {
  await page.getByRole('button', { name: /weeks|semanas/iu }).click()
})

When('I order the rows by total', async ({ page }) => {
  await page.getByRole('button', { name: /^total$/iu }).click()
})

/**
 * Read off the picker, not off the heading. The heading names the screen and
 * stays put; what proves the address was honoured is the control that says which
 * team is being reported — and it says so by its chosen option's name, because
 * the value it carries is an identifier that names nobody.
 */
Then('the team shown is {string}', async ({ page }, name: string) => {
  const picker = page.getByRole('combobox', { name: TEAM_PICKER })

  await expect(picker).toHaveValue(FISCAL_TEAM.id)
  await expect(picker.locator('option:checked')).toHaveText(name)
})

Then('the month shown is May 2026', async ({ page }) => {
  await expect(page.getByText(/may 2026|maio de 2026/iu).first()).toBeVisible()
})

Then('the address says the columns are weeks', async ({ page }) => {
  await expect(page).toHaveURL(/by=weeks/u)
})

/**
 * Nothing asked which day, which is the state an unnarrowed report is in.
 *
 * At the reader's whole reach almost every row is short, so the probe would run
 * on every report to locate what is the ordinary condition rather than a
 * finding — and mark a handful of rows chosen by an identifier nobody sees.
 */
Then('GitLab is never asked which day they fell on', async ({ page }) => {
  // The screen's own idle signal, not a timeout: the sync region says it is
  // fetching while anything is, and the probe is issued from the same settled
  // report that put the row on screen. Once it stops saying so, every request
  // this report was going to make has been made.
  await expect(page.getByRole('status')).not.toContainText(/updating|atualizand/iu)

  expect(probes.get(page)?.count ?? 0).toBe(0)
})
