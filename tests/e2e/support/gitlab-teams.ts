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
 * would correctly get no figures at all — a fixture that tested nothing it meant to.
 *
 * The middle of the month also puts it far from either boundary, so no offset
 * between UTC and the reader's zone can move it into a neighbouring month.
 */
const SPENT_AT = '2026-05-12T15:00:00.000Z'

export const SQUAD = {
  fullPath: 'invent-software/squad-fiscal',
  id: 'gid://gitlab/Group/64237110',
  name: 'squad-fiscal',
}

/** The people a team names. Features name them. */
export const ANA = { name: 'Ana Carolina', username: 'ana' }
export const BRUNO = { name: 'Bruno Teixeira', username: 'bruno' }

/** Somebody who logged in the group without being on the reader's team. */
export const DIEGO = { name: 'Diego Alves', username: 'diego' }

/**
 * An account that logged time in the group and runs nobody's timesheet.
 *
 * Here because GROUP-15's two rules about who is offered run in opposite
 * directions, and a window holding only ordinary active people could express
 * neither of them. A bot is dropped: nobody manages its hours, and a reader who
 * genuinely wants one can still add it by name.
 */
const RELEASE_BOT = { name: 'Release Bot', username: 'release-bot' }

/**
 * Somebody who logged time in the window and has since been blocked or left.
 *
 * Kept, which is the rule that surprises people. They did the work, so the
 * hours are theirs and a lead reading last quarter needs them — the opposite of
 * the clutter the membership rule removed, where most of a group's access list
 * had never touched time tracking at all.
 */
const HELENA = { name: 'Helena Prado', username: 'helena' }

/**
 * The group's contributors, exactly as the provider describes each of them.
 *
 * `bot` and `state` are carried per person rather than defaulted, because they
 * are the two facts the suggestion rule turns on and a table of four people who
 * all agree about them cannot express either rule. Two of these are dropped
 * before they reach the reader and two are not, and which two is the whole
 * assertion.
 */
const CONTRIBUTORS: readonly { bot: boolean; person: Person; state: string }[] = [
  { bot: false, person: ANA, state: 'active' },
  { bot: false, person: DIEGO, state: 'active' },
  { bot: true, person: RELEASE_BOT, state: 'active' },
  { bot: false, person: HELENA, state: 'blocked' },
]

/** Hours the fixture logs for Ana. `features/acceptance/*` state the number. */
export const ANA_HOURS = 6.5

/**
 * How many of those hours were logged inside the group the filter names.
 *
 * Fewer than she logged altogether, and that gap is the whole substance of
 * narrowing: the filter changes every figure on the screen and changes nothing
 * about how the screen looks. A fixture that answered the same either way would
 * let a report that lost the filter — out of the address, out of the query key,
 * out of the request — pass every assertion there is about it, because the only
 * thing left to observe would be a sentence saying what the figures mean.
 */
export const SCOPED_HOURS = 4.5

/** Hours GitLab counts for Ana but does not show. Features state the number. */
export const HIDDEN_HOURS = 2.5

/** Which grid column the fixture puts the withheld entry in: the day Ana logged. */
const WITHHELD_ON = SPENT_AT.slice(0, 'YYYY-MM-DD'.length)

/**
 * A person the provider resolved and holds nothing for in this window.
 *
 * Not the same answer as one it would not resolve at all: that row says nothing
 * is known and draws no total, where this is a real colleague with a real zero.
 * Bruno is here every time — he is the case the screen exists for — and so is
 * anybody a scenario has stopped logging.
 */
const NOTHING_LOGGED = {
  count: 0,
  nodes: [],
  pageInfo: { endCursor: null, hasNextPage: false },
  totalSpentTime: '0',
}

/**
 * A payload, built from the request that asked for it.
 *
 * Every operation answers through one of these even though only the column
 * probe reads its argument: one shape means the caller has no branch to take,
 * and the fixture's own lint rules ask for one return type rather than two.
 */
type Answer = (variables: Record<string, unknown>) => unknown

/** Somebody the fixture can name: what to call them, and the handle behind it. */
interface Person {
  readonly name: string
  readonly username: string
}

interface TeamStub {
  /** Seconds GitLab counts for Ana beyond what it shows. */
  hidden?: number
  /** False makes the group the filter names one this reader may not read. */
  readable?: boolean
  /**
   * Somebody who has stopped logging time in the group.
   *
   * Both halves of that, because a suggestion is only proved not to be a
   * subscription if the group really did change: they drop out of the
   * contributors the group is seeded from, and the hours document resolves them
   * with nothing in the month. Resolved rather than absent — an unresolved
   * member is GROUP-21's case and says nothing is known, where this person is
   * one the provider will still name and has no hours for.
   */
  stopped?: Person
}

/** One entry, as the hours document asks for it: no project, no user, no summary. */
interface TimelogNode {
  readonly id: string
  readonly spentAt: string
  readonly timeSpent: number
}

/** The GraphQL operation a request carries, or an empty string. */
export function operationOf(route: Route): string {
  const body: unknown = route.request().postDataJSON()
  const query = typeof body === 'object' && body !== null && 'query' in body ? body.query : ''

  return typeof query === 'string' ? (/query\s+(\w+)/u.exec(query)?.[1] ?? '') : ''
}

/**
 * Stands in for the team half of GitLab's GraphQL endpoint.
 *
 * Registered after the personal stub so it sees each request first, and it hands
 * anything it does not recognise straight back — the two stubs answer different
 * operations on one endpoint.
 */
export async function stubTeamHours(page: Page, options: TeamStub = {}): Promise<void> {
  await page.route(GRAPHQL, async (route) => {
    const answer = answerFor(operationOf(route), options)

    if (answer === null) {
      await route.fallback()

      return
    }

    await route.fulfill({ json: answer(variablesOf(route)) })
  })
}

/** A team whose people logged nothing in the month. */
export async function stubTeamWithNoHours(page: Page): Promise<void> {
  await stubTeamHours(page)
  await page.route(GRAPHQL, async (route) => {
    if (operationOf(route) === 'TeamHoursPage') {
      await route.fulfill({ json: hoursPayload([]) })

      return
    }

    await route.fallback()
  })
}

/** A filter naming a group this reader cannot open. */
export async function stubUnreadableGroup(page: Page): Promise<void> {
  await stubTeamHours(page, { readable: false })
}

export function userNode(person: Person) {
  return {
    id: `gid://gitlab/User/${person.username}`,
    name: person.name,
    username: person.username,
    webUrl: `https://gitlab.com/${person.username}`,
  }
}

function answerFor(operation: string, options: TeamStub): Answer | null {
  // Only the group lookup is refused. Refusing the hours as well would test a
  // reader who can see nothing at all, where this is a reader who can see their
  // team's hours and cannot open the group their link tried to narrow to.
  if (options.readable === false && operation === 'GroupRef') {
    return () => ({ data: { group: null } })
  }

  return answersFor(options)[operation] ?? null
}

/**
 * Every operation this stub knows, as a table rather than a chain.
 *
 * Built per call because two of the answers close over the options. A chain of
 * one branch per document would grow with every document the app learns to send,
 * which is the shape the complexity ceiling exists to refuse.
 */
function answersFor(options: TeamStub): Record<string, Answer> {
  return {
    GroupRef: () => ({ data: { group: SQUAD } }),
    GroupSuggestions: () => suggestionsPayload(options),
    MyGroups: () => ({ data: { groups: { nodes: [SQUAD] } } }),
    PeopleSearch: () => ({ data: { users: { nodes: [userNode(DIEGO)] } } }),
    TeamColumnProbe: columnPayload(options),
    TeamHoursPage: (variables) => hoursPayload([timelogNode(ANA, hoursFor(variables))], options),
  }
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
function columnPayload(options: TeamStub) {
  const hidden = options.hidden ?? 0
  const withheld = hidden === 0 ? 0 : 1

  return (variables: Record<string, unknown>) => {
    // The same reach the page document was answered under. The probe carries
    // `$group` too, and a placement measured against a wider period than the
    // figures it is placing would be refused by `model/withheld.ts` — correctly,
    // and for a reason that lives only in this fixture.
    const visible = hoursFor(variables) * SECONDS_PER_HOUR
    const user: Record<string, unknown> = { id: userNode(ANA).id }
    const spans = Object.keys(variables).filter((name) => /^f\d+$/u.test(name))

    for (const [index, name] of spans.entries()) {
      const opens = String(variables[name])
      const holds = opens.startsWith(WITHHELD_ON) || spansTheDay(opens, spans.length)

      user[`c${String(index)}`] = holds
        ? { count: 1 + withheld, totalSpentTime: String(visible + hidden) }
        : { count: 0, totalSpentTime: '0' }
    }

    user['period'] = { count: 1 + withheld, totalSpentTime: String(visible + hidden) }

    return { data: { user } }
  }
}

/**
 * How much of Ana's month this particular request reaches.
 *
 * Read off `$group` — null on an unnarrowed request, the group's identifier on a
 * narrowed one — rather than off the operation, because that variable is the
 * only place the difference exists. A request that dropped the filter on its way
 * to the provider is indistinguishable from one that never carried it, and this
 * is where the two are told apart.
 */
function hoursFor(variables: Record<string, unknown>): number {
  return (variables['group'] ?? null) === null ? ANA_HOURS : SCOPED_HOURS
}

/**
 * One round of the team's window: a node per person, aggregates and all.
 *
 * `totalSpentTime` is a string, because that is how GraphQL serialises a
 * `BigInt` and a fixture that disagreed with GitLab would pass while the app
 * failed. Ana's declared total is what she was shown plus whatever is hidden;
 * the count rises with it, because the count and the sum are one SQL pass over
 * one relation and the screen reads the count to decide whether anything was
 * removed at all.
 *
 * The declaration is summed from the nodes rather than restated from a constant.
 * The provider computes the two over one relation, so they cannot disagree
 * there; restating it here meant a narrowed answer could hand over four and a
 * half hours while declaring six and a half, and the screen would have reported
 * the fixture's own arithmetic as two hours GitLab was withholding.
 *
 * Bruno is asked about and answers with nothing. That is the case this screen
 * exists for: the reader chose him, so the row is the answer.
 */
function hoursPayload(nodes: readonly TimelogNode[], options: TeamStub = {}) {
  const hidden = options.hidden ?? 0
  const visible = nodes.reduce((total, node) => total + node.timeSpent, 0)
  const counted = nodes.length + (hidden === 0 ? 0 : 1)

  return {
    data: {
      users: {
        nodes: [
          {
            ...userNode(ANA),
            timelogs: {
              count: counted,
              nodes,
              pageInfo: { endCursor: null, hasNextPage: false },
              totalSpentTime: String(visible + hidden),
            },
          },
          { ...userNode(BRUNO), timelogs: NOTHING_LOGGED },
          ...(options.stopped === undefined
            ? []
            : [{ ...userNode(options.stopped), timelogs: NOTHING_LOGGED }]),
        ],
        pageInfo: { hasNextPage: false },
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

/**
 * Whoever logged time in the group over the suggestion window.
 *
 * Diego is here and Bruno is not: suggestions are who logged, not who has
 * access, and the difference is the whole reason this document is paged rather
 * than a cheap membership page.
 *
 * Whoever the options say has stopped is left out, because that is what having
 * stopped means to this document: the group's contributors are read from its
 * entries, so a person with none of them in the window is simply not in the
 * answer.
 */
function suggestionsPayload(options: TeamStub) {
  const logged = CONTRIBUTORS.filter(({ person }) => person !== options.stopped)

  return {
    data: {
      group: {
        timelogs: {
          nodes: logged.map(({ bot, person, state }) => ({
            user: { ...userNode(person), bot, state },
          })),
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      },
    },
  }
}

function timelogNode(person: Person, hours: number) {
  return {
    id: `gid://gitlab/Timelog/${person.username}`,
    spentAt: SPENT_AT,
    timeSpent: hours * SECONDS_PER_HOUR,
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
