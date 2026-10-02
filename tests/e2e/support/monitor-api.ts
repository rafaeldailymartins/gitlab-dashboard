import type { Page } from '@playwright/test'

/**
 * The fault-reporting tunnel, recorded rather than run.
 *
 * `vite preview` serves a static `dist/` and runs no function, so this stub is
 * all the tunnel there is in this suite, exactly as for the document endpoints.
 * What it can prove is what the browser sends — every report, as the text that
 * would leave the page — which is where OBS-3 is decided. What the tunnel does
 * with a report afterwards is proved by `netlify/lib/envelope-tunnel.test.mts`.
 */
const ENDPOINT = '**/.netlify/functions/monitor*'

const sent = new WeakMap<Page, string[]>()

/** The error events inside every report sent so far, parsed. */
export function eventsSent(page: Page): readonly Record<string, unknown>[] {
  return reportsSent(page).flatMap((envelope) => {
    const [, ...lines] = envelope.split('\n')
    const events: Record<string, unknown>[] = []

    for (let index = 0; index + 1 < lines.length; index += 2) {
      const header = JSON.parse(lines[index] ?? '{}') as { type?: string }

      if (header.type === 'event') {
        events.push(JSON.parse(lines[index + 1] ?? '{}') as Record<string, unknown>)
      }
    }

    return events
  })
}

/** Answers every report with `status`, and keeps each one's body. */
export async function recordFaultReports(page: Page, status = 200): Promise<void> {
  sent.set(page, [])
  await page.route(ENDPOINT, async (route) => {
    sent.get(page)?.push(route.request().postData() ?? '')
    await route.fulfill({ status })
  })
}

/** Every report the page has sent so far, as the text that left it. */
export function reportsSent(page: Page): readonly string[] {
  return sent.get(page) ?? []
}
