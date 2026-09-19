import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { failTimelogs, stubEmptyTimelogs, stubTimelogs } from '../support/gitlab-api'
import { stubTeamHours } from '../support/gitlab-teams'
import { ACCEPTANCE_ORIGIN } from '../support/origin'
import { stubTeamsStore } from '../support/teams-api'

const { Given, Then, When } = createBdd()

const AUTHORIZE = '**/oauth/authorize*'
const TOKEN = '**/oauth/token'
const REVOKE = '**/oauth/revoke'

interface AuthorizationOptions {
  readonly expiresInSeconds?: number
  /**
   * False issues a grant with no identity assertion in it.
   *
   * What a session granted before this application asked for one looks like:
   * everything it authorises still works, and the teams surface is the only
   * place that notices. Renewing carries the original scopes forward, so it
   * never repairs itself — only authorising again does.
   */
  readonly identifies?: boolean
  readonly outcome: 'granted' | 'refused'
}

/** How long the provider says an identity assertion lives. Two minutes, verified. */
const IDENTITY_SECONDS = 120

const MILLISECONDS_PER_SECOND = 1000

/** What the authorize endpoint was asked for, and how often a token was issued. */
const attempts = new WeakMap<Page, { authorizeUrl: string; tokenCalls: number }>()

/**
 * An identity assertion the browser can read the expiry out of.
 *
 * Unsigned on purpose, and that is not a shortcut: the browser deliberately
 * does not check the signature (`model/id-token.ts` says why — the token
 * arrived over TLS in the answer to this browser's own request, and the check
 * that matters happens on the store that spends it). What the browser needs
 * from it is `exp`, and nothing else in it is read here.
 */
function identityAssertion(): string {
  const expiry = Math.floor(Date.now() / MILLISECONDS_PER_SECOND) + IDENTITY_SECONDS

  return `${segment({ alg: 'RS256', typ: 'JWT' })}.${segment({ exp: expiry, sub: '2318742' })}.stub`
}

function record(page: Page): { authorizeUrl: string; tokenCalls: number } {
  const existing = attempts.get(page) ?? { authorizeUrl: '', tokenCalls: 0 }
  attempts.set(page, existing)

  return existing
}

/** One base64url segment of a token, as the provider encodes them. */
function segment(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url').replaceAll('=', '')
}

/**
 * Stands in for GitLab's authorization page.
 *
 * The real page cannot be driven from a test — it needs a human and a real
 * account — so what gets stubbed is the redirect it would perform. The `state`
 * is echoed back from the request the app actually sent, so the check that a
 * callback belongs to this attempt is genuinely exercised rather than bypassed.
 */
async function stubAuthorization(
  page: Page,
  { expiresInSeconds = 7200, identifies = true, outcome }: AuthorizationOptions,
): Promise<void> {
  const seen = record(page)

  await page.route(AUTHORIZE, async (route) => {
    const sent = new URL(route.request().url())
    const callback = new URL('/auth/callback', ACCEPTANCE_ORIGIN)
    seen.authorizeUrl = sent.toString()

    if (outcome === 'granted') {
      callback.searchParams.set('code', 'test-authorization-code')
      callback.searchParams.set('state', sent.searchParams.get('state') ?? '')
    } else {
      callback.searchParams.set('error', 'access_denied')
    }

    await route.fulfill({
      body: `<meta http-equiv="refresh" content="0;url=${callback.toString()}">`,
      contentType: 'text/html',
    })
  })

  await page.route(TOKEN, async (route) => {
    seen.tokenCalls += 1
    await route.fulfill({
      json: {
        access_token: `test-access-${String(seen.tokenCalls)}`,
        expires_in: expiresInSeconds,
        refresh_token: `test-refresh-${String(seen.tokenCalls)}`,
        ...(identifies ? { id_token: identityAssertion() } : {}),
      },
    })
  })

  await page.route(REVOKE, async (route) => {
    await route.fulfill({ status: 200 })
  })
}

Given('GitLab will authorise this application', async ({ page }) => {
  await stubAuthorization(page, { outcome: 'granted' })
})

Given('my session predates the permission to identify me', async ({ page }) => {
  await stubAuthorization(page, { identifies: false, outcome: 'granted' })
  await stubTimelogs(page)
  await stubTeamHours(page)
  await page.goto('/')
  await page.getByRole('button', { name: /continue with gitlab/i }).click()
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
  await expect(page.getByRole('status')).toBeVisible()
})

Given(
  'GitLab will authorise this application, with a credential that expires at once',
  async ({ page }) => {
    // Below the renewal margin, so the very next request has to renew first.
    await stubAuthorization(page, { expiresInSeconds: 30, outcome: 'granted' })
    await stubTimelogs(page)
  },
)

Given('GitLab will refuse to authorise this application', async ({ page }) => {
  await stubAuthorization(page, { outcome: 'refused' })
})

Given('GitLab has nothing logged for me', async ({ page }) => {
  await stubEmptyTimelogs(page)
})

Given('GitLab cannot be reached', async ({ page }) => {
  await failTimelogs(page)
})

Given('I am signed in', async ({ page }) => {
  await stubAuthorization(page, { outcome: 'granted' })
  await stubTimelogs(page)
  // The team endpoint too: it is the same endpoint, and the screen sweep opens
  // the team report like any other screen.
  await stubTeamHours(page)
  // And the store the teams live in, which is not GitLab at all. Without it the
  // report has no team to be about, and the sweep would measure a note.
  await stubTeamsStore(page)
  await page.goto('/')
  await page.getByRole('button', { name: /continue with gitlab/i }).click()
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
  // The header appears while the callback is still navigating on to the
  // dashboard. Waiting for something only the dashboard renders is what makes
  // the next step's navigation safe: otherwise it cancels this one mid-flight.
  await expect(page.getByRole('status')).toBeVisible()
})

When('I sign in', async ({ page }) => {
  // Whatever the scenario already stubbed for the data endpoint stands: this
  // step only registers the authorization it needs and walks the flow.
  await stubAuthorization(page, { outcome: 'granted' })
  await page.goto('/')
  await page.getByRole('button', { name: /continue with gitlab|continuar com o gitlab/i }).click()
  await expect(page.getByRole('status')).toBeVisible()
})

When('I continue with GitLab', async ({ page }) => {
  await page.getByRole('button', { name: /continue with gitlab/i }).click()
})

When('I sign out', async ({ page }) => {
  await page.getByRole('button', { name: /sign out/i }).click()
})

Then('I am asked to sign in', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: /sign in/i })).toBeVisible()
})

Then('there is nowhere to paste a token', async ({ page }) => {
  await expect(page.locator('input')).toHaveCount(0)
})

When('I open the sign-in screen', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('main')).toBeVisible()
})

Then('there is no navigation and no way to sign out', async ({ page }) => {
  // The header is the signed-in chrome and belongs to the authenticated layout,
  // so the guard that proves there is a session is the same thing that decides
  // the header exists. Gating it on React state let the two disagree.
  await expect(page.getByRole('banner')).toHaveCount(0)
  await expect(page.getByRole('navigation')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /sign out|sair/i })).toHaveCount(0)
})

Then('I am told the sign-in did not complete', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: /did not complete/i })).toBeVisible()
})

Then('I am offered another attempt', async ({ page }) => {
  await expect(page.getByRole('link', { name: /try again/i })).toBeVisible()
})

Then('no credential remains on the device', async ({ page }) => {
  const stored = await page.evaluate(() => globalThis.localStorage.getItem('gitlab.refreshToken'))

  expect(stored).toBeNull()
})

Then('GitLab is asked to read and to identify, and for nothing else', async ({ page }) => {
  // The click that reaches GitLab has not necessarily landed yet.
  await expect.poll(() => attempts.get(page)?.authorizeUrl ?? '').not.toBe('')

  const asked = new URL(attempts.get(page)?.authorizeUrl ?? 'https://example.invalid')

  // `read_api` reads the hours; `openid` is what lets the teams store be told
  // who is calling without this application vouching for the reader itself.
  // Neither grants a write, and no third scope is asked for.
  expect(asked.searchParams.get('scope')).toBe('read_api openid')
  expect(asked.searchParams.get('response_type')).toBe('code')
  expect(asked.searchParams.get('code_challenge_method')).toBe('S256')
  // A public client has no secret to send, and sending one would mean it does.
  expect(asked.searchParams.get('client_secret')).toBeNull()
})

Then('no access token is anywhere on this device', async ({ page }) => {
  const stored = await page.evaluate(() =>
    [globalThis.localStorage, globalThis.sessionStorage]
      .flatMap((store) => Object.entries(store))
      .map((pair) => pair.join('='))
      .join('|'),
  )

  expect(stored).not.toContain('test-access')
  // The identity assertion is held the same way and for the same reason: it is
  // spendable on the teams store by whoever holds it, so it lives two minutes in
  // a closure and is minted again when it is next needed.
  expect(stored).not.toContain('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9')
  // The refresh token is stored on purpose; only the spendable ones are not.
  expect(stored).toContain('test-refresh')
})

Then('the credential was renewed', async ({ page }) => {
  // Once for the authorization code, once because the first one was already due.
  await expect.poll(() => attempts.get(page)?.tokenCalls ?? 0).toBeGreaterThan(1)
})
