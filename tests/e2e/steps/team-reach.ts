import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { deviceContents, PERSONAL_HISTORY } from '../support/device'
import { ANA, BRUNO } from '../support/gitlab-teams'
import { FISCAL_TEAM } from '../support/teams-api'

const { Given, Then } = createBdd()

/** Long enough to outlast the cache's own trailing-edge write. */
const PERSISTED_WITHIN = 10_000

/** The widest reach this screen has: every hour the provider counts. */
const EVERYWHERE = /wherever they logged it|onde quer que tenham sido lançadas/iu

/** The key every answer on this screen would be persisted under, if any were. */
const TEAM_HOURS = 'team-timelogs'

/**
 * The reader's own history, on the device, before anything else is measured.
 *
 * Waited for rather than assumed. The cache is written on a trailing throttle
 * and every `goto` is a real reload that rebuilds the client from whatever
 * reached IndexedDB, so a scenario that left the dashboard within a second of
 * arriving would go looking for a colleague's name in a store nothing had ever
 * been written to — which is the vacuous check this whole scenario replaces.
 */
Given('my own hours have reached the device', async ({ page }) => {
  await expect
    .poll(() => deviceContents(page), { timeout: PERSISTED_WITHIN })
    .toContain(PERSONAL_HISTORY)
})

/**
 * Twice, deliberately.
 *
 * The sentence under the heading is what a reader looking at the page sees; the
 * caption is what a reader who jumps straight to the table hears, and an empty
 * cell is only honest because that caption qualifies it.
 */
Then('the screen says the figures cover everywhere these people logged', async ({ page }) => {
  await expect(page.getByText(EVERYWHERE).first()).toBeVisible()
  await expect(page.locator('caption')).toContainText(EVERYWHERE)
})

/**
 * The reach is wider than the reader's own sight, and the screen says so.
 *
 * A figure here may count hours logged on work this account cannot open, taken
 * from what the provider declares about the person rather than read from any
 * entry. A reader who took a total for something they could go and inspect would
 * be wrong about it and would have no way to find out.
 */
Then('the figures are said to include work this account cannot open', async ({ page }) => {
  await expect(page.locator('caption')).toContainText(/cannot open|não pode abrir/iu)
})

Then(
  'the screen says the figures cover {string} and its subgroups',
  async ({ page }, group: string) => {
    const scoped = new RegExp(`${group}[^.]*(subgroups|subgrupos)`, 'iu')

    await expect(page.getByText(scoped).first()).toBeVisible()
    await expect(page.locator('caption')).toContainText(scoped)
  },
)

/**
 * The way back sits above whatever the search found.
 *
 * Everywhere is the honest default and the widest state, so it is never further
 * than the top of the list — and it is a group with an empty path, which is what
 * "no group" is everywhere else in this app.
 */
Then('the filter offers the way back to everywhere first', async ({ page }) => {
  const offered = page.getByRole('listbox').getByRole('option').first()

  await expect(offered).toHaveText(/everywhere|em todo lugar/iu)
})

Then('the filter offers {string}', async ({ page }, name: string) => {
  const offered = page.getByRole('listbox').getByRole('option', { name: new RegExp(name, 'iu') })

  await expect(offered).toBeVisible()
})

/**
 * The narrowing is dropped, not the report.
 *
 * An empty scoped report and an unreadable scope are different facts, and the
 * reader came for the figures: they are shown at their whole reach, above a
 * sentence saying the link's narrowing could not be honoured.
 */
Then('the screen says the narrowing was dropped', async ({ page }) => {
  const dropped = /could not be read with your account|não pôde ser lido com a sua conta/iu

  await expect(page.getByText(dropped)).toBeVisible()
})

Then('the row for {string} says hours of theirs are missing', async ({ page }, name: string) => {
  const row = page.getByRole('row').filter({ hasText: name })

  await expect(row.getByText(/hidden|ocultas/iu)).toBeVisible()
})

/**
 * The one region this control owns says when the hours arrived, whether they
 * are arriving now, and whether asking failed. What a figure could not include
 * is said beside that figure, on the row it belongs to — which the step above
 * proves is where it actually is, so this absence is a placement and not a
 * silence.
 */
Then('the sync control says only when the hours arrived', async ({ page }) => {
  const status = page.getByRole('status')

  await expect(status).toHaveText(/updated|updating|atualizad/iu)
  await expect(status).not.toHaveText(/hidden|ocultas|cannot read|não pode ler/iu)
})

/**
 * Completed by redirecting, not by filling the screen in behind the address:
 * what a reader is looking at has to be what they can send somebody else.
 */
Then('the address names the team I chose', async ({ page }) => {
  await expect.poll(() => new URL(page.url()).searchParams.get('team')).toBe(FISCAL_TEAM.id)
})

/**
 * Read as a parameter rather than matched against the whole URL: a group path
 * is full of slashes, and escaping one into a pattern is a way to be wrong about
 * what the test asserts.
 */
Then('the address narrows to {string}', ({ page }, group: string) => {
  expect(new URL(page.url()).searchParams.get('group')).toBe(group)
})

Then('the address narrows to nothing', ({ page }) => {
  expect(new URL(page.url()).searchParams.get('group') ?? '').toBe('')
})

/**
 * The reader's own hours are kept on the device so a return visit paints at
 * once. A team's hours belong to other people, and so do its names: a shared or
 * borrowed machine must not tell whoever opens the app next who this reader
 * watches.
 */
Then('nothing about my team is written to the device', async ({ page }) => {
  // Still there after the reload the report arrived by, so what follows is read
  // off a store this app has written to and restored from.
  await expect
    .poll(() => deviceContents(page), { timeout: PERSISTED_WITHIN })
    .toContain(PERSONAL_HISTORY)

  const kept = await deviceContents(page)

  expect(kept).not.toContain(TEAM_HOURS)
  expect(kept).not.toContain(ANA.name)
  expect(kept).not.toContain(BRUNO.name)
})

/**
 * The anchor for the step below, and the reason signing out is worth a scenario
 * of its own.
 *
 * Everything else here is an absence, and an absence proves nothing about a
 * store that was never written to. This one is the opposite claim: the reader's
 * own history reached the device — the `Given` waited until it had — and signing
 * out took it away again. So the probe is reading a real store, it was reading a
 * full one a moment ago, and what is gone was cleared rather than never written.
 */
Then('my own hours are gone from the device', async ({ page }) => {
  await expect
    .poll(() => deviceContents(page), { timeout: PERSISTED_WITHIN })
    .not.toContain(PERSONAL_HISTORY)
})

/**
 * What signing out leaves behind, on the machine the next reader will use.
 *
 * The report is never persisted in the first place — `query-shape.ts` marks
 * every answer on this screen `persist: false` — so this is not a second way of
 * asserting that. It is the question of whether leaving can *add* something: the
 * cache is cleared and the persisted client removed on the way out, and a write
 * still in flight when that happened would land after it, unwitnessed, carrying
 * whatever the last screen held. A team's name, a colleague's name, a
 * colleague's identifier and this screen's own cache key are each looked for,
 * because the roster is stored by identifier and the name is only half of it.
 *
 * `team-report-team` is deliberately not among them. GROUP-18 permits exactly
 * one thing to survive — the identifier of the team last looked at — because it
 * is a label this app minted and names nobody, and the reader who signs in next
 * on this device would otherwise begin by picking their own team out of a list.
 */
Then('no team, no roster and no figure is left on the device', async ({ page }) => {
  const kept = await deviceContents(page)

  expect(kept).not.toContain(TEAM_HOURS)
  expect(kept).not.toContain(FISCAL_TEAM.name)
  expect(kept).not.toContain(ANA.name)
  expect(kept).not.toContain(BRUNO.name)

  for (const member of FISCAL_TEAM.members) {
    expect(kept).not.toContain(member.id)
  }
})
