import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { deviceContents } from '../support/device'
import { ANA, BRUNO, DIEGO, userNode } from '../support/gitlab-teams'
import { stubTeamsStore } from '../support/teams-api'

const { Given, Then } = createBdd()

/**
 * The teams endpoint, named again here rather than imported.
 *
 * `support/teams-api.ts` owns the stub that answers it, and answers from memory
 * — which is exactly what a read that never arrives cannot be expressed as.
 * These two steps need the endpoint itself: one to refuse a read, the other to
 * count what left the browser.
 */
const STORE = '**/.netlify/functions/teams'

const UNAVAILABLE = 503

/**
 * How long a refusal is given to reach the screen.
 *
 * The query client retries twice with exponential backoff before it reports a
 * failure (`shared/api/query-client.ts`), so about three seconds pass between
 * the store refusing and the screen saying so. Playwright's five-second default
 * covers that on an idle machine and loses the race on a loaded one, which is a
 * flake rather than a finding.
 */
const SETTLES = { timeout: 15_000 }

/** Writes the store was asked for, per page. */
const writes = new WeakMap<Page, { count: number }>()

/**
 * Counts every write the browser sends, from before the screen is opened.
 *
 * Counted at the request rather than in the stub, because the claim is about
 * what left the browser at all: a mutation retried behind the reader's back and
 * a failed change replayed after a reload are both invisible to a stub that
 * answers each request the same way.
 */
function countWrites(page: Page): void {
  const seen = { count: 0 }

  writes.set(page, seen)
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('/functions/teams')) {
      seen.count += 1
    }
  })
}

Given('my teams cannot be read from the store', async ({ page }) => {
  await page.route(STORE, async (route) => {
    await route.fulfill({ status: UNAVAILABLE })
  })
})

Given('the store will not accept a change', async ({ page }) => {
  await stubTeamsStore(page, { writeFails: 'unavailable' })
  countWrites(page)
})

Given('my teams were changed on another device', async ({ page }) => {
  // The store answers a write with the version it holds instead of taking it,
  // which is what another device having written first looks like from here.
  await stubTeamsStore(page, { writeFails: 'conflict' })
})

Then('the screen says the change was saved', async ({ page }) => {
  await expect(page.getByRole('status')).toHaveText(/^saved\.$|^salvo\.$/iu)
})

Then('the screen says the change was not saved', async ({ page }) => {
  await expect(page.getByRole('status')).toHaveText(
    /could not be saved|não foi possível salvar/iu,
    SETTLES,
  )
})

/**
 * Told, not obeyed. The sentence says the change did not land *and* that what is
 * on screen is now somebody else's version, which is the difference between this
 * and an ordinary failure.
 */
Then('the screen says the team was changed somewhere else', async ({ page }) => {
  await expect(page.getByRole('status')).toHaveText(
    /changed somewhere else|alteradas em outro lugar/iu,
    SETTLES,
  )
})

Then('the screen says my teams could not be loaded', async ({ page }) => {
  await expect(page.getByText(/could not be loaded|não foi possível carregar/iu)).toBeVisible(
    SETTLES,
  )
})

/**
 * Two claims out of one sentence, on purpose.
 *
 * A reader whose grant predates the identity scope must not be told the store is
 * down: that sends them away to wait for something that will never change on its
 * own. What they need is what is missing and that authorising again supplies it.
 */
Then(
  'the screen says permission to identify me is needed, and offers a fresh sign-in',
  async ({ page }) => {
    await expect(
      page.getByText(/permission to identify you|permissão de identificar/iu),
    ).toBeVisible(SETTLES)
    await expect(page.getByText(/sign in again|entre de novo/iu)).toBeVisible()
  },
)

/**
 * One change was made, and one write left the browser.
 *
 * A mutation retried behind the reader's back and a failed change replayed after
 * the reload both land here, and both are the queue this screen refuses to keep:
 * a write whose ordering nobody can see, replayed against a document another
 * device may already have changed.
 */
Then('nothing was written to the store a second time', ({ page }) => {
  expect(writes.get(page)?.count ?? 0).toBe(1)
})

/**
 * A roster is a list of colleagues' names, and a shared machine must not keep
 * one — the identifier as much as the name, since that is what the document
 * stores a member by.
 */
Then('nobody on the team is named anywhere on this device', async ({ page }) => {
  const kept = await deviceContents(page)

  // The probe has to have read the device, or every absence below is free. The
  // refresh token is kept there deliberately — it is the one credential that is
  // — so finding it is what tells a real dump from an empty string.
  expect(kept).toContain('test-refresh')

  for (const person of [ANA, BRUNO, DIEGO]) {
    expect(kept).not.toContain(person.name)
    expect(kept).not.toContain(userNode(person).id)
  }
})
