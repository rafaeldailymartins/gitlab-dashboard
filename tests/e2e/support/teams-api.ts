import type { Page } from '@playwright/test'

import { ANA, BRUNO, userNode } from './gitlab-teams'

/**
 * The teams endpoint, stubbed — because the acceptance suite cannot run it.
 *
 * `playwright.config.ts` serves a built `dist/` with `vite preview`, which is a
 * static file server: there is no Netlify runtime in it and no function to call.
 * `@netlify/vite-plugin` would not help either, because it registers only
 * `configureServer` and there is no `configurePreviewServer` hook to register.
 *
 * So the endpoint is route-stubbed here, exactly as GitLab already is, and the
 * rules the real one enforces — a credential it verified for itself, a key
 * derived from that credential and from nothing the request carried, a write
 * refused unless it names the version it was made against — are proved instead
 * by the `functions` Vitest project against the real handler. That split is
 * recorded in `docs/qa/quality-metrics.md`; a stub cannot prove a rule it is
 * itself implementing.
 */
const ENDPOINT = '**/.netlify/functions/teams'

/** The team every acceptance feature opens. Its identifier is stable so an address can name it. */
export const FISCAL_TEAM = {
  id: '018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d70',
  members: [memberOf(ANA), memberOf(BRUNO)],
  name: 'Squad Fiscal',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

interface StoredTeam {
  id: string
  members: { id: string; name: string; username: string }[]
  name: string
  updatedAt: string
}

interface TeamsStub {
  /** What the store already holds. Empty is a reader who has made no team. */
  teams?: readonly StoredTeam[]
  /**
   * What a write is answered with instead of being accepted.
   *
   * `conflict` returns the current document, which is the whole point of the
   * version check: the reader is told their change did not land AND shown what
   * is there now, rather than being obeyed over somebody else's roster.
   */
  writeFails?: 'conflict' | 'unavailable'
}

const CONFLICT = 409
const NO_CONTENT_CHANGE = 200
const UNAVAILABLE = 503
const UNAUTHENTICATED = 401

/**
 * A store that answers from memory, and remembers what the screen wrote.
 *
 * A closure rather than a module variable: two scenarios in one file must not
 * see each other's teams, and Playwright runs them in the same worker.
 */
export async function stubTeamsStore(page: Page, options: TeamsStub = {}): Promise<void> {
  let stored: readonly StoredTeam[] = options.teams ?? [FISCAL_TEAM]
  let version = 1

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
      if (options.writeFails === 'unavailable') {
        await route.fulfill({ status: UNAVAILABLE })

        return
      }

      if (options.writeFails === 'conflict') {
        await route.fulfill({
          headers: etagFor(version),
          json: { teams: stored },
          status: CONFLICT,
        })

        return
      }

      stored = writtenTeams(request.postData() ?? '')
      version += 1
    }

    await route.fulfill({
      headers: etagFor(version),
      json: { teams: stored },
      status: NO_CONTENT_CHANGE,
    })
  })
}

/** A reader whose session was granted before the app asked to identify them. */
export async function stubTeamsWithoutIdentity(page: Page): Promise<void> {
  await page.route(ENDPOINT, async (route) => {
    await route.fulfill({ status: UNAUTHENTICATED })
  })
}

function etagFor(version: number): Record<string, string> {
  return { etag: `"${String(version)}"` }
}

function memberOf(person: { name: string; username: string }) {
  return { id: userNode(person).id, name: person.name, username: person.username }
}

/** What the screen sent, read back leniently — a stub is not a validator. */
function writtenTeams(body: string): readonly StoredTeam[] {
  try {
    const parsed: unknown = JSON.parse(body)
    const teams =
      typeof parsed === 'object' && parsed !== null && 'teams' in parsed ? parsed.teams : []

    return Array.isArray(teams) ? (teams as StoredTeam[]) : []
  } catch {
    return []
  }
}
