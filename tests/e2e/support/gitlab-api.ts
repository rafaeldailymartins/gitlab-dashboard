import type { Page, Route } from '@playwright/test'

const GRAPHQL = '**/api/graphql'

const SECONDS_PER_HOUR = 3600

/** `America/Sao_Paulo`, which is the app's default time-zone preference. */
const ZONE_OFFSET_MS = 3 * 60 * 60 * 1000

const DATE_LENGTH = 'YYYY-MM-DD'.length

const PROJECT = {
  fullPath: 'invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
  name: 'invent.fiscal.inventariofiscal',
  webUrl: 'https://gitlab.com/invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
}

/** Hours the fixture logs today. `features/acceptance/*` state the same number. */
export const LOGGED_TODAY = 6.5

/**
 * Hours the fixture logs the day before, which is also the entry the withheld
 * fixtures withhold. `features/acceptance/*` state the same number.
 */
export const HOURS_YESTERDAY = 3

/** Which entry GitLab withholds: yesterday's, so a recovered day has a figure. */
const WITHHELD_INDEX = 1

/**
 * What GitLab reports for an entry whose project it will not resolve, recorded
 * from production. `Timelog.project` is non-nullable and the connection's items
 * are not, so the whole entry comes back as `null`.
 */
const WITHHELD_PROJECT_ERROR = {
  message: 'Cannot return null for non-nullable field Timelog.project',
  path: ['currentUser', 'timelogs', 'nodes', WITHHELD_INDEX, 'project'],
}

/**
 * An entry the recovery request cannot recover either, because a second
 * non-nullable field failed to resolve. Nothing more can be asked of GitLab for
 * it, so its hours are missing and the screen has to say so.
 */
const UNREADABLE_ENTRY_ERROR = {
  message: 'Cannot return null for non-nullable field Timelog.timeSpent',
  path: ['currentUser', 'timelogs', 'nodes', WITHHELD_INDEX, 'timeSpent'],
}

/** The name the fixture signs in as. `features/acceptance/*` greet it. */
export const VIEWER_NAME = 'Ada Lovelace'

const VIEWER_ANSWER = { data: { currentUser: { name: VIEWER_NAME } } }

const NO_HOURS = {
  data: {
    currentUser: { timelogs: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } } },
  },
}

/** Answers slowly, so a test can see what the reader sees before data arrives. */
export async function stubSlowTimelogs(page: Page, delayMs: number): Promise<void> {
  asked.set(page, { count: 0 })
  await page.route(GRAPHQL, async (route) => {
    countAsk(page)
    await new Promise((resolve) => {
      setTimeout(resolve, delayMs)
    })
    await answer(route, payload())
  })
}

/**
 * Stands in for GitLab's GraphQL endpoint.
 *
 * The real one needs a real account, and a real account's hours change every
 * day. Stubbing it is what lets the suite assert on figures rather than on the
 * mere presence of a number.
 */
export async function stubTimelogs(page: Page): Promise<void> {
  asked.set(page, { count: 0 })
  await page.route(GRAPHQL, async (route) => {
    countAsk(page)
    await answer(route, payload())
  })
}

/**
 * Answers whichever of the two queries arrived.
 *
 * The hours and the viewer's name share this endpoint, so the stub has to read
 * the request to know what it is answering. Handing the hours payload to the
 * viewer query would fail its schema and greet nobody, without saying why.
 */
async function answer(route: Route, hours: unknown): Promise<void> {
  await route.fulfill({ json: isPersonalHours(route) ? hours : VIEWER_ANSWER })
}

/**
 * Whether this request is the signed-in person's own history.
 *
 * The operation name decides, not the query text: `GroupHoursPage` also contains
 * the substring `timelogs`, and answering it with this payload would hand the
 * team screen the personal fixture — which parses, renders, and would make the
 * suite pass on entirely the wrong data.
 */
function isPersonalHours(route: Route): boolean {
  return operationOf(route) === 'MyTimelogs'
}

/**
 * Midday in the reader's zone, on a day counted from the reader's today.
 *
 * This used to be midday UTC on a day counted from UTC's today, and the suite
 * failed every evening after 21:00 in Brazil: UTC had already rolled over, so
 * `middayUtc(0)` was the reader's tomorrow and "today reads 6.5 hours" found
 * yesterday's three. The app buckets days in `America/Sao_Paulo`, which is the
 * default preference, so the fixture has to count them there too. Brazil has had
 * no daylight saving since 2019, which is what makes a fixed offset honest here.
 */
function middayLocal(daysAgo: number): string {
  const local = new Date(Date.now() - ZONE_OFFSET_MS)
  local.setUTCDate(local.getUTCDate() - daysAgo)

  // Midday in a zone three hours behind UTC, so the entry sits mid-afternoon
  // UTC and lands on the same calendar day whichever side of it is read.
  return `${local.toISOString().slice(0, DATE_LENGTH)}T15:00:00.000Z`
}

function node(daysAgo: number, hours: number, iid: number) {
  return {
    issue: {
      reference: `${PROJECT.fullPath}#${String(iid)}`,
      title: 'Totalizador de valor de estoque do inventário',
      webUrl: `${PROJECT.webUrl}/-/work_items/${String(iid)}`,
    },
    mergeRequest: null,
    project: PROJECT,
    spentAt: middayLocal(daysAgo),
    summary: '',
    timeSpent: hours * SECONDS_PER_HOUR,
  }
}

/**
 * The entries of the one page this stub serves.
 *
 * The acceptance features state these same figures; changing one means changing
 * the other.
 */
function nodes() {
  return [node(0, LOGGED_TODAY, 153), node(1, HOURS_YESTERDAY, 129), node(40, 4, 128)]
}

function onePage(entries: unknown[]) {
  return {
    data: {
      currentUser: {
        timelogs: { nodes: entries, pageInfo: { endCursor: null, hasNextPage: false } },
      },
    },
  }
}

/** The GraphQL operation a request carries, or an empty string. */
function operationOf(route: Route): string {
  return /query\s+(\w+)/u.exec(queryOf(route))?.[1] ?? ''
}

/** One page of hours, ending the history. */
function payload() {
  return onePage(nodes())
}

/** The query text the request carries, or an empty string if it carries none. */
function queryOf(route: Route): string {
  const body: unknown = route.request().postDataJSON()
  const query = typeof body === 'object' && body !== null && 'query' in body ? body.query : ''

  return typeof query === 'string' ? query : ''
}

/**
 * How many times the endpoint has been asked since it was stubbed.
 *
 * Kept beside the page rather than in a step, because Gherkin steps share
 * nothing but the page and the claim worth making — a return visit costs no
 * request — spans two of them.
 */
const asked = new WeakMap<Page, { count: number }>()

/** An endpoint that cannot be reached at all. */
export async function failTimelogs(page: Page): Promise<void> {
  asked.set(page, { count: 0 })
  await page.route(GRAPHQL, async (route) => {
    countAsk(page)
    await route.abort('connectionfailed')
  })
}

/** An account with no time logged at all. */
export async function stubEmptyTimelogs(page: Page): Promise<void> {
  await page.route(GRAPHQL, async (route) => {
    await answer(route, NO_HOURS)
  })
}

/**
 * GitLab withholding one entry from both answers, so nothing recovers it.
 *
 * The reader's hours are then short by an entry, and the screen has to say so
 * rather than present the figures as whole.
 */
export async function stubUnreadableTimelogs(page: Page): Promise<void> {
  asked.set(page, { count: 0 })
  await page.route(GRAPHQL, async (route) => {
    countAsk(page)
    await answerWithheld(route, {
      ...onePage(withheld(withoutProjects())),
      errors: [UNREADABLE_ENTRY_ERROR],
    })
  })
}

/**
 * GitLab withholding one entry, and answering the recovery request in full.
 *
 * This is the production shape that emptied a reader's dashboard: `200`, with
 * entries in `data` and errors beside them. The recovery request is the same
 * query without `project`, so whether the query names that field is what tells
 * the two apart here.
 */
export async function stubWithheldTimelogs(page: Page): Promise<void> {
  asked.set(page, { count: 0 })
  await page.route(GRAPHQL, async (route) => {
    countAsk(page)
    await answerWithheld(route, onePage(withoutProjects()))
  })
}

export function timesAsked(page: Page): number {
  return asked.get(page)?.count ?? 0
}

/** Answers the recovery request with `recovery`, and the first one withheld. */
async function answerWithheld(route: Route, recovery: unknown): Promise<void> {
  if (!isPersonalHours(route)) {
    await route.fulfill({ json: VIEWER_ANSWER })

    return
  }

  await route.fulfill({ json: queryOf(route).includes('project') ? withheldPayload() : recovery })
}

function countAsk(page: Page): void {
  const tally = asked.get(page) ?? { count: 0 }
  tally.count += 1
  asked.set(page, tally)
}

function withheld(entries: unknown[]) {
  return entries.map((entry, index) => (index === WITHHELD_INDEX ? null : entry))
}

/** The page as GitLab answers it when it cannot resolve one entry's project. */
function withheldPayload() {
  return { ...onePage(withheld(nodes())), errors: [WITHHELD_PROJECT_ERROR] }
}

/**
 * The same entries with no `project` member: what the recovery request asks for.
 *
 * The withheld one loses its issue as well. `Timelog.issue` is nullable, so a
 * reader who cannot resolve a project — because access to it went away — gets
 * `null` there rather than an error, and that is the shape the screens have to
 * render: an entry with neither a project nor a work item to name it by.
 */
function withoutProjects() {
  return nodes().map(({ project: _project, ...rest }, index) =>
    index === WITHHELD_INDEX ? { ...rest, issue: null } : rest,
  )
}
