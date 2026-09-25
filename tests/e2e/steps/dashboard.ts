import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, Then } = createBdd()

/**
 * One failing rule, read off the builder rather than imported from `axe-core`.
 *
 * `axe-core` is in the tree already, as `@axe-core/playwright`'s own
 * dependency, and declaring a second one beside it is how the types come to
 * describe a version the run does not use. Derived here, the shape is whatever
 * the installed builder really returns and cannot drift from it.
 */
type Violation = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number]

/**
 * WCAG 2.1 A and AA, plus axe's best-practice rules. The best-practice set is
 * stricter than the standard requires — unique landmarks, heading order,
 * meaningful link text — and catches the things a reader notices before a
 * checklist does.
 */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']

/** How many failing elements one violation names before it starts summarising. */
const MAX_NODES_NAMED = 4

Given('my system prefers the {word} colour scheme', async ({ page }, scheme: string) => {
  await page.emulateMedia({ colorScheme: scheme === 'dark' ? 'dark' : 'light' })
})

// Step text is matched regardless of the Given/When/Then keyword, so this one
// definition serves both "Given I open the dashboard" and "When I open ...".
Given('I open the dashboard', async ({ page }) => {
  await page.goto('/')

  // `goto` resolves on the load event, when a client-rendered app has painted
  // nothing yet. Auditing at that point measures an empty document — which is
  // how this suite first "passed" on chromium and failed on webkit. Waiting for
  // the main landmark makes the step mean what it says.
  await expect(page.getByRole('main')).toBeVisible()
})

Then('I see the dashboard', async ({ page }) => {
  await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
})

Then('I am on the settings page', async ({ page }) => {
  await expect(
    page.getByRole('heading', { level: 1, name: /settings|configurações/i }),
  ).toBeVisible()
})

Then('I see the page heading', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

/**
 * What a violation has to say for somebody to be able to act on it.
 *
 * The rule's name and a node count is not enough. A contrast failure that only
 * appears on one engine, in CI, is read out of a log by somebody who cannot
 * open the page it happened on, and "4 nodes" sends them looking for four
 * elements the message declines to name. axe already computed the selector and
 * the two colours it compared; this carries them out. Bounded, because a rule
 * failing on fifty elements is one fault repeated and the fifth line adds
 * nothing to the diagnosis.
 */
function detail(violation: Violation): string {
  const shown = violation.nodes.slice(0, MAX_NODES_NAMED)
  const rest = violation.nodes.length - shown.length
  const named = shown.map((node) => {
    const why = (node.failureSummary ?? '').replaceAll('\n', ' ')

    return `\n    ${node.target.join(' ')}\n      ${why}`
  })

  return [
    `${violation.id} (${String(violation.nodes.length)} nodes): ${violation.help}`,
    ...named,
    rest > 0 ? `\n    and ${String(rest)} more` : '',
  ].join('')
}

/**
 * Every animation in the document, finished.
 *
 * `toBeVisible()` is satisfied by a box on screen, and opacity is not part of
 * that — so a dialog that fades in over 100 ms is "visible" the instant it
 * mounts, and an audit run there measures text part of the way through its own
 * transition. That is not a hypothesis. On WebKit, axe reported the teams
 * dialog's secondary text at 3.58:1 against `#0f1413`, and the row beneath it at
 * 3.62:1 against `#101614` — two lines of one list, on one surface, reported
 * against two different backgrounds, because the opacity was still climbing
 * between the two reads. Settled, the same pair measures 5.96:1.
 *
 * It failed on WebKit and nowhere else, one run in three, and a retry cleared
 * it — so it reached `main` green, as a flake nobody had a reason to read.
 *
 * Infinite animations are left alone: `animate-pulse` on a skeleton and
 * `animate-spin` on a loader never finish, and awaiting one would hang the audit
 * rather than settle it. A cancelled animation rejects, which is also settled.
 *
 * This is the same lesson as the wait in `I open the dashboard` above, one step
 * further in: an audit is only worth what the page was doing when it ran.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const running = document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getComputedTiming()

      return timing !== undefined && timing.iterations !== Number.POSITIVE_INFINITY
    })

    // A cancelled animation rejects, and a cancelled animation is settled.
    await Promise.all(
      running.map(async (animation) => {
        await animation.finished.catch(() => {
          /* settled by cancellation */
        })
      }),
    )
  })
}

Then('the page has no accessibility violations', async ({ page }) => {
  await settle(page)

  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()

  expect(results.violations.map((violation) => detail(violation))).toEqual([])
})

Then('today reads {float} hours', async ({ page }, hours: number) => {
  const today = page.getByRole('group', { name: /^(today|hoje)$/i })

  await expect(today).toContainText(String(hours))
})

Then("I am greeted by name above the day's heading", async ({ page }) => {
  // The first word of the fixture's name, which is how someone is greeted: the
  // provider stores one name field and no notion of a given name.
  await expect(page.getByText(/^(hello|olá), ada$/i)).toBeVisible()
})
