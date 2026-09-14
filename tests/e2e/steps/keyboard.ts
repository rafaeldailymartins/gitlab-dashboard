import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, Then, When } = createBdd()

/** More stops than any screen here has, so the walk ends by running out of them. */
const MAX_STOPS = 40

const PHONE_HEIGHT = 812

/** The least a dashboard worth tabbing through should offer. */
const MINIMUM_STOPS = 5

/** A screen is named in the feature file; only the step knows its address. */
const SCREENS: Record<string, string> = {
  'a day': '/days/2026-08-20',
  dashboard: '/',
  insights: '/insights',
  settings: '/settings',
  team: '/team?group=invent-software%2Fsquad-fiscal&month=2026-05&by=days',
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

  expect(path, `No address is registered for the "${screen}" screen`).not.toBe('')
  await page.goto(path)
  await expect(page.getByRole('main')).toBeVisible()
  // Measuring while a skeleton is still standing measures the loading layout,
  // not the one the reader ends up with.
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
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
