import { expect, type Page } from '@playwright/test'

import { VERSION_HEADER } from '../../../src/shared/api/document-version'

const ENDPOINT = '**/.netlify/functions/preferences'

/**
 * What each page's stub is holding.
 *
 * A change is carried after a settle, so a scenario that navigated straight
 * after setting a field would race the write it depends on. Waiting on the
 * document itself rather than on a request is what makes that deterministic —
 * and counting requests would not have been enough either, because the first one
 * a device makes is the push of what it already had, before the reader touched
 * anything.
 */
const observed = new WeakMap<Page, { document: unknown }>()

const OK = 200
const UNAUTHENTICATED = 401

/** Waits until the store is holding this target, which is what a device sent it. */
export async function storeHolds(page: Page, weekday: number, hours: number): Promise<void> {
  await expect
    .poll(() => targetOf(observed.get(page)?.document, weekday), { timeout: 10_000 })
    .toBe(hours)
}

/**
 * The settings endpoint, stubbed — because the acceptance suite cannot run it.
 *
 * `playwright.config.ts` serves a built `dist/` with `vite preview`, which is a
 * static file server: there is no Netlify runtime in it and no function to call.
 * So this is route-stubbed exactly as the teams endpoint and GitLab already are,
 * and the rules the real one enforces — a credential it verified for itself, a
 * key derived from that credential and from nothing the request carried, a write
 * refused unless it names the version it was made against — are proved instead
 * by the `functions` Vitest project against the real handler.
 *
 * What this *can* prove, and what the deployed one could not be asked to, is the
 * half that lives in the browser: that a device reads its own values first, that
 * it sends them, and that a second device with nothing of its own adopts them.
 * The stub holds one document for the whole page, which is exactly the shape of
 * "one reader, two devices".
 */
export async function stubPreferencesStore(page: Page): Promise<void> {
  const seen: { document: unknown } = { document: null }
  let version = 0

  observed.set(page, seen)

  await page.route(ENDPOINT, async (route) => {
    const request = route.request()

    // The real endpoint refuses a request carrying no credential without saying
    // why. The stub asserts the app sends one at all — a bearer that never
    // arrived would otherwise pass here and fail only in production.
    if ((request.headers()['authorization'] ?? '') === '') {
      await route.fulfill({ status: UNAUTHENTICATED })

      return
    }

    if (request.method() === 'PUT') {
      seen.document = JSON.parse(request.postData() ?? 'null')
      version += 1
    }

    await route.fulfill({
      // `null` is what a reader the store has never heard of is answered with,
      // which is what tells a device to send its own rather than adopt defaults.
      body: JSON.stringify(seen.document),
      contentType: 'application/json',
      headers: { [VERSION_HEADER]: `"${String(version)}"` },
      status: OK,
    })
  })
}

/** The target the stored document names for a weekday, or null. */
function targetOf(document: unknown, weekday: number): null | number {
  if (typeof document !== 'object' || document === null || !('dailyTarget' in document)) {
    return null
  }

  const target = document.dailyTarget

  if (typeof target !== 'object' || target === null) {
    return null
  }

  const hours = (target as Record<string, unknown>)[String(weekday)]

  return typeof hours === 'number' ? hours : null
}
