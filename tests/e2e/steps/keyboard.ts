import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { FISCAL_TEAM } from '../support/teams-api'

const { Given, Then, When } = createBdd()

/** More stops than any screen here has, so the walk ends by running out of them. */
const MAX_STOPS = 40

const PHONE_HEIGHT = 812

/** The least a dashboard worth tabbing through should offer. */
const MINIMUM_STOPS = 5

/**
 * A screen is named in the feature file; only the step knows how to reach it.
 *
 * The report is addressed by team and by nothing else. An address naming no team
 * renders a one-paragraph note, and every sweep over this screen would then
 * measure that note: axe would never reach the matrix, and UI-11's real risk
 * here — a month-wide sticky grid pushing the page sideways — would go
 * unexercised. The identifier comes from the fixture rather than being repeated,
 * because a literal that drifts from the stubbed store fails as a missing team
 * rather than as a wrong address.
 *
 * No group is named: the filter is empty by default and deliberately not
 * remembered between visits, so the unscoped report is both the state a reader
 * arrives in and the wider one.
 *
 * "teams" is no longer an address at all. The teams a reader keeps are edited in
 * a dialog over the report, so reaching it is the report's address plus one
 * click — which is what `opens` is for. Dropping it from these sweeps because it
 * stopped being a URL would have quietly stopped checking a surface, and a
 * dialog is exactly where a focus trap and a 375 px overflow live.
 */
const SCREENS: Record<string, string> = {
  'a day': '/days/2026-08-20',
  dashboard: '/',
  insights: '/insights',
  settings: '/settings',
  team: `/team?team=${FISCAL_TEAM.id}&month=2026-05&by=days`,
  teams: `/team?team=${FISCAL_TEAM.id}&month=2026-05&by=days`,
}

/** What a screen needs after its address before it is the screen being named. */
const OPENS: Record<string, RegExp> = {
  teams: /manage teams|gerenciar equipes/iu,
}

/**
 * What the navigation calls each screen. Kept apart from `SCREENS` because the
 * two are not the same list: a day is a screen the reader can open and not a
 * place the navigation goes, and neither are the teams — "Equipes" beside
 * "Equipe" at 375 px is one word twice, so they are reached from a control on
 * the report and a card on settings instead. That is why this list stays at
 * four.
 */
const NAVIGATION_NAMES: Record<string, string> = {
  dashboard: 'Dashboard',
  insights: 'Insights',
  settings: 'Settings',
  team: 'Team',
}

interface Stop {
  readonly focusVisible: boolean
  readonly isDayRow: boolean
  readonly name: string
}

/**
 * Walks focus through the page, recording what it reached and whether each stop
 * showed where focus was.
 *
 * A focus indicator here is an outline or a ring drawn as a box shadow, which is
 * how this design draws it. Reading the computed style is the only way to know
 * the reader could see it: that an element has focus says nothing about that.
 */
async function walkFocus(page: Page): Promise<Stop[]> {
  const stops: Stop[] = []

  for (let step = 0; step < MAX_STOPS; step += 1) {
    await page.keyboard.press('Tab')

    const stop = await page.evaluate(() => {
      const element = document.activeElement

      if (!element || element === document.body) {
        return null
      }

      const style = globalThis.getComputedStyle(element)
      const outlined = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0
      const ringed = style.boxShadow !== 'none' && style.boxShadow !== ''

      return {
        focusVisible: outlined || ringed,
        isDayRow: element.getAttribute('aria-expanded') !== null,
        name: `${element.tagName}: ${element.textContent.trim().slice(0, 40)}`,
      }
    })

    if (!stop) {
      break
    }

    stops.push(stop)
  }

  return stops
}

Given('my viewport is {int} pixels wide', async ({ page }, width: number) => {
  await page.setViewportSize({ height: PHONE_HEIGHT, width })
})

When('I open the {string} screen', async ({ page }, screen: string) => {
  const path = SCREENS[screen] ?? ''
  const opens = OPENS[screen]

  expect(path, `No address is registered for the "${screen}" screen`).not.toBe('')
  await page.goto(path)
  await expect(page.getByRole('main')).toBeVisible()
  // Measuring while a skeleton is still standing measures the loading layout,
  // not the one the reader ends up with.
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)

  if (opens !== undefined) {
    await page.getByRole('button', { name: opens }).first().click()
    await expect(page.locator('[data-slot="dialog-content"]')).toBeVisible()
    await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
  }
})

/**
 * Asked of the whole navigation rather than of one link, because the failure this
 * guards against marks nothing rather than marking the wrong thing — and a
 * single-link assertion would also pass on a navigation that marked all four.
 */
Then('the navigation marks {string} as the screen I am on', async ({ page }, screen: string) => {
  const expected = NAVIGATION_NAMES[screen] ?? ''

  expect(expected, `No navigation name is registered for the "${screen}" screen`).not.toBe('')

  const current = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link')

  await expect(current.and(page.locator('[aria-current="page"]'))).toHaveText([expected])
})

Then('the page does not scroll sideways', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )

  expect(overflow).toBeLessThanOrEqual(1)
})

Then('I can reach every control by keyboard, each showing where focus is', async ({ page }) => {
  const stops = await walkFocus(page)

  expect(stops.length, 'Tab reached nothing at all').toBeGreaterThan(MINIMUM_STOPS)
  expect(stops.filter((stop) => !stop.focusVisible).map((stop) => stop.name)).toEqual([])
  // The feed is the screen's substance, so reaching it is part of being
  // operable rather than a separate claim.
  expect(
    stops.some((stop) => stop.isDayRow),
    'Tab never reached a day of the feed',
  ).toBe(true)
})
