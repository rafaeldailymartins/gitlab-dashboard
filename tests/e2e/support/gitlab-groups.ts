import type { Page, Route } from '@playwright/test'

const GRAPHQL = '**/api/graphql'

const SECONDS_PER_HOUR = 3600

/**
 * Midday on a Tuesday in the middle of the month every team feature asks for.
 *
 * Fixed rather than counted back from today, which is what the personal fixture
 * beside this one does. The dashboard shows the days around now; this report is
 * addressed by month, and `features/acceptance/*` name 2026-05. An entry dated
 * today would fall outside the month under test, and the person who logged it
 * would correctly get no row at all — a fixture that tested nothing it meant to.
 *
 * The middle of the month also puts it far from either boundary, so no offset
 * between UTC and the reader's zone can move it into a neighbouring month.
 */
const SPENT_AT = '2026-05-12T15:00:00.000Z'

export const SQUAD = { fullPath: 'invent-software/squad-fiscal', name: 'squad-fiscal' }

/** The people the fixture puts in the group. Features name them. */
export const ANA = { name: 'Ana Carolina', username: 'ana' }
export const BRUNO = { name: 'Bruno Teixeira', username: 'bruno' }

/** Hours the fixture logs for Ana. `features/acceptance/*` state the number. */
export const ANA_HOURS = 6.5

/** Hours GitLab counts for Ana but does not show. Features state the number. */
export const HIDDEN_HOURS = 2.5

interface AccessLevel {
  integerValue: number
  stringValue: string
}

const REPORTER: AccessLevel = { integerValue: 20, stringValue: 'REPORTER' }

interface GroupStub {
  /** The reader's own level in the group. Guest is what explains a shortfall. */
  access?: AccessLevel
  /** Seconds GitLab counts for Ana beyond what it shows. */
  hidden?: number
  /** False makes the group one this reader may not read. */
  readable?: boolean
}

/** Which grid column the fixture puts the withheld entry in: the day Ana logged. */
const WITHHELD_ON = SPENT_AT.slice(0, 'YYYY-MM-DD'.length)

/**
 * A payload, built from the request that asked for it.
 *
 * Every operation answers through one of these even though only the column
 * probe reads its argument: one shape means the caller has no branch to take,
 * and the fixture's own lint rules ask for one return type rather than two.
 */
type Answer = (variables: Record<string, unknown>) => unknown

/** The GraphQL operation a request carries, or an empty string. */
export function operationOf(route: Route): string {
  const body: unknown = route.request().postDataJSON()
  const query = typeof body === 'object' && body !== null && 'query' in body ? body.query : ''

  return typeof query === 'string' ? (/query\s+(\w+)/u.exec(query)?.[1] ?? '') : ''
}

/** A group with a membership and no hours logged in the month. */
export async function stubEmptyGroup(page: Page): Promise<void> {
  await stubGroupHours(page, { hidden: 0 })
  await page.route(GRAPHQL, async (route) => {
    if (operationOf(route) === 'GroupHoursPage') {
      await route.fulfill({ json: hoursPayload([]) })

      return
    }

    await route.fallback()
  })
}

/**
 * Stands in for the group half of GitLab's GraphQL endpoint.
 *
 * Registered after the personal stub so it sees each request first, and it hands
 * anything it does not recognise straight back — the two stubs answer different
 * operations on one endpoint.
 */
export async function stubGroupHours(page: Page, options: GroupStub = {}): Promise<void> {
  await page.route(GRAPHQL, async (route) => {
    const answer = answerFor(operationOf(route), options)

    if (answer === null) {
      await route.fallback()

      return
    }

    await route.fulfill({ json: answer(variablesOf(route)) })
  })
}

/** A group the reader may not read at all. */
export async function stubUnreadableGroup(page: Page): Promise<void> {
  await stubGroupHours(page, { readable: false })
}

function answerFor(operation: string, options: GroupStub): Answer | null {
  if (options.readable === false && operation.startsWith('Group')) {
    return () => ({ data: { group: null } })
  }

  if (operation === 'GroupHoursPage') {
    return () => hoursPayload([timelogNode(ANA, ANA_HOURS)])
  }

  if (operation === 'GroupRoster') {
    return () => rosterPayload(options)
  }

  if (operation === 'GroupMonthProbe') {
    return () => probePayload(options)
  }

  if (operation === 'GroupColumnProbe') {
    return columnPayload(options)
  }

  return operation === 'MyGroups' ? () => groupsPayload() : null
}

/**
 * One person's month, column by column.
 *
 * Answers by alias position, as GitLab does. The column the fixture logged on
 * declares Ana's visible hours plus whatever is being held back, and every
 * other column declares nothing — so the columns tile the period exactly, which
 * is the check the placement refuses to proceed without.
 *
 * Built from the request rather than from a fixed list of days, because the
 * screen decides how many columns there are: thirty-one under day columns, five
 * under week columns.
 */
function columnPayload(options: GroupStub) {
  const hidden = options.hidden ?? 0
  const visible = ANA_HOURS * SECONDS_PER_HOUR
  const withheld = hidden === 0 ? 0 : 1

  return (variables: Record<string, unknown>) => {
    const group: Record<string, unknown> = { ...SQUAD }
    const spans = Object.keys(variables).filter((name) => /^f\d+$/u.test(name))

    for (const [index, name] of spans.entries()) {
      const opens = String(variables[name])
      const holds = opens.startsWith(WITHHELD_ON) || spansTheDay(opens, spans.length)

      group[`c${String(index)}`] = holds
        ? { count: 1 + withheld, totalSpentTime: String(visible + hidden) }
        : { count: 0, totalSpentTime: '0' }
    }

    group['period'] = { count: 1 + withheld, totalSpentTime: String(visible + hidden) }

    return { data: { group } }
  }
}

function groupsPayload() {
  return { data: { groups: { nodes: [SQUAD] } } }
}

function hoursPayload(nodes: unknown[]) {
  return {
    data: {
      group: {
        ...SQUAD,
        timelogs: { nodes, pageInfo: { endCursor: null, hasNextPage: false } },
      },
    },
  }
}

function memberNode(person: { name: string; username: string }) {
  return { accessLevel: REPORTER, user: { ...userNode(person), bot: false, state: 'active' } }
}

/**
 * The window's aggregates, and Ana's own.
 *
 * `totalSpentTime` is a string, because that is how GraphQL serialises a
 * `BigInt` and a fixture that disagreed with GitLab would pass while the app
 * failed. Ana's declared total is what she was shown plus whatever is hidden.
 */
function probePayload(options: GroupStub) {
  const visible = ANA_HOURS * SECONDS_PER_HOUR
  const hidden = options.hidden ?? 0
  // The aggregate counts the entry it withheld as well as the one it showed.
  // A stub that answered `count: 1` beside seconds saying two entries exist
  // would describe an answer GitLab cannot give — the count and the sum are one
  // SQL pass over one relation — and the screen reads the count to decide
  // whether anything was removed at all.
  const counted = hidden === 0 ? 1 : 2

  return {
    data: {
      group: {
        ...SQUAD,
        maxAccessLevel: options.access ?? REPORTER,
        p0: { count: counted, totalSpentTime: String(visible + hidden) },
        p1: { count: 0, totalSpentTime: '0' },
        window: { count: counted, totalSpentTime: String(visible + hidden) },
      },
    },
  }
}

function rosterPayload(options: GroupStub) {
  return {
    data: {
      group: {
        ...SQUAD,
        groupMembers: {
          nodes: [memberNode(ANA), memberNode(BRUNO)],
          pageInfo: { endCursor: null, hasNextPage: false },
        },
        maxAccessLevel: options.access ?? REPORTER,
      },
    },
  }
}

/**
 * Whether a week column covers the day the fixture logged on.
 *
 * Under week columns a span opens on a Monday, so the day itself is inside it
 * rather than at its start. Only one column can hold it, or the counts would
 * double and the placement would rightly refuse them.
 */
function spansTheDay(opens: string, count: number): boolean {
  const DAYS_IN_WEEK = 7

  if (count > DAYS_IN_WEEK) {
    return false
  }

  const start = opens.slice(0, 'YYYY-MM-DD'.length)
  const next = new Date(Date.parse(`${start}T00:00:00.000Z`) + DAYS_IN_WEEK * 86_400_000)

  return start <= WITHHELD_ON && WITHHELD_ON < next.toISOString().slice(0, 'YYYY-MM-DD'.length)
}

function timelogNode(person: { name: string; username: string }, hours: number) {
  return {
    id: `gid://gitlab/Timelog/${person.username}`,
    spentAt: SPENT_AT,
    timeSpent: hours * SECONDS_PER_HOUR,
    user: userNode(person),
  }
}

function userNode(person: { name: string; username: string }) {
  return {
    id: `gid://gitlab/User/${person.username}`,
    name: person.name,
    username: person.username,
    webUrl: `https://gitlab.com/${person.username}`,
  }
}

/** The variables a request carries, or none. */
function variablesOf(route: Route): Record<string, unknown> {
  const body: unknown = route.request().postDataJSON()

  if (typeof body !== 'object' || body === null || !('variables' in body)) {
    return {}
  }

  return typeof body.variables === 'object' && body.variables !== null
    ? (body.variables as Record<string, unknown>)
    : {}
}
