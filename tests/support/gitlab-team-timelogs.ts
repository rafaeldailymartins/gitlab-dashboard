import type {
  Member,
  Person,
  ReferenceSchedule,
  SuggestedMember,
  TeamTimelogEntry,
} from '@/entities/team-timelogs'

/**
 * Fixtures for a team's timelogs, shaped from a real `users { timelogs }`
 * response recorded from gitlab.com while designing the query.
 *
 * The global-id forms, the `totalSpentTime` **string**, the nullable node and
 * the instant format are all exactly what GitLab sends. A fixture that agreed
 * with our own schema but not with GitLab's would pass while the app failed —
 * which is the reason the personal fixtures beside this file are shaped the same
 * way.
 */
export const SQUAD_FISCAL = {
  fullPath: 'invent-software/invent-apps-2/squad-fiscal',
  id: 'gid://gitlab/Group/64237110',
  name: 'squad-fiscal',
}

export const ANA: Person = {
  id: 'gid://gitlab/User/2318742',
  name: 'Ana Carolina de Jesus Souza',
  username: 'ana.souza',
  webUrl: 'https://gitlab.com/ana.souza',
}

export const BRUNO: Person = {
  id: 'gid://gitlab/User/2318743',
  name: 'Bruno Teixeira Lima',
  username: 'bruno.lima',
  webUrl: 'https://gitlab.com/bruno.lima',
}

export const CAMILA: Person = {
  id: 'gid://gitlab/User/2318744',
  name: 'Camila Rocha Vieira',
  username: 'camila.vieira',
  webUrl: 'https://gitlab.com/camila.vieira',
}

/** Somebody who logged time in the group without the reader naming them. */
export const DIEGO: Person = {
  id: 'gid://gitlab/User/2318745',
  name: 'Diego Alves Prado',
  username: 'diego.prado',
  webUrl: 'https://gitlab.com/diego.prado',
}

/**
 * Eight hours Monday to Friday, nothing at the weekend — the schedule the rules
 * are exercised against.
 *
 * It is also the reader's default daily target, so a screen rendered without
 * preferences measures against the same thing. The screen itself never reads
 * this: it passes whatever the reader set under their working schedule.
 */
export const EIGHT_BY_FIVE: ReferenceSchedule = { 1: 8, 2: 8, 3: 8, 4: 8, 5: 8, 6: 0, 7: 0 }

let nextId = 13_709_983

interface HoursPayloadOverrides {
  hasNextPage?: boolean
  people?: readonly PersonPayload[]
  users?: null
}

/** One person's node: who they are, what they logged, and what was declared. */
interface PersonPayload {
  cursor?: null | string
  declared?: null | { entryCount: number; seconds: number }
  more?: boolean
  nodes?: unknown[]
  person: Person
}

interface SuggestionNodeOverrides {
  bot?: boolean
  state?: string
}

interface SuggestionsPayloadOverrides {
  endCursor?: null | string
  group?: null
  hasNextPage?: boolean
  nodes?: unknown[]
}

interface TimelogNodeOverrides {
  spentAt?: null | string
  timeSpent?: number
}

interface UserNode {
  id: string
  name: string
  username: string
  webUrl: string
}

/** One person's period and columns, as `teamColumnProbe` answers it. */
export function columnProbePayload(
  columns: readonly { entryCount: number; seconds: number }[],
  period: { entryCount: number; seconds: number },
  person: Person = ANA,
) {
  const aliases = Object.fromEntries(
    columns.map((column, index) => [`c${String(index)}`, declaredNode(column)]),
  )

  return { user: { id: person.id, period: declaredNode(period), ...aliases } }
}

/** One normalised entry. Ids are distinct so a reconciliation can tell them apart. */
export function entry(spentAt: string, seconds: number): TeamTimelogEntry {
  nextId += 1

  return { id: `gid://gitlab/Timelog/${String(nextId)}`, seconds, spentAt: new Date(spentAt) }
}

/** A `TeamHoursFollowing` answer: one alias per person, in the order asked. */
export function followingPayload(people: readonly PersonPayload[]) {
  return Object.fromEntries(
    people.map((one, index) => [`a${String(index)}`, personNode(one, false)]),
  )
}

/** The reader's authorized groups, for the picker. */
export function groupsPayload() {
  return { groups: { nodes: [SQUAD_FISCAL] } }
}

/** Somebody a team names, as the report is handed them. */
export function member(person: Person): Member {
  return { id: person.id, name: person.name, username: person.username }
}

/** A `PeopleSearch` answer. */
export function peoplePayload(people: readonly Person[] = [ANA]) {
  return { users: { nodes: people.map((person) => userNode(person)) } }
}

/**
 * A page GitLab redacted: `count` and `totalSpentTime` describe more than the
 * nodes hold.
 *
 * This is the shape the whole shortfall apparatus exists for, and it carries no
 * error and no null — the entries are simply not in the array.
 */
export function redactedHoursPayload() {
  return teamHoursPayload({
    people: [
      { declared: { entryCount: 40, seconds: 500_000 }, nodes: [timelogNode()], person: ANA },
    ],
  })
}

/** Somebody who logged time in the group. Active and human unless told otherwise. */
export function suggestedMember(
  person: Person,
  overrides: Partial<Omit<SuggestedMember, 'person'>> = {},
): SuggestedMember {
  return { active: true, bot: false, person, ...overrides }
}

export function suggestionNode(person: Person, overrides: SuggestionNodeOverrides = {}) {
  return {
    user: { ...userNode(person), bot: overrides.bot ?? false, state: overrides.state ?? 'active' },
  }
}

/** A `GroupSuggestions` answer, defaulting to one page that ends the window. */
export function suggestionsPayload(overrides: SuggestionsPayloadOverrides = {}) {
  if (overrides.group === null) {
    return { group: null }
  }

  return {
    group: {
      timelogs: {
        nodes: overrides.nodes ?? [suggestionNode(ANA)],
        pageInfo: {
          endCursor: overrides.endCursor ?? 'eyJzcGVudF9hdCI6IjIwMjYtMDUtMTIifQ',
          hasNextPage: overrides.hasNextPage ?? false,
        },
      },
    },
  }
}

/** A `TeamHoursPage` answer, defaulting to one person whose round is final. */
export function teamHoursPayload(overrides: HoursPayloadOverrides = {}) {
  if (overrides.users === null) {
    return { users: null }
  }

  const people = overrides.people ?? [{ person: ANA }]

  return {
    users: {
      nodes: people.map((one) => personNode(one, true)),
      pageInfo: { hasNextPage: overrides.hasNextPage ?? false },
    },
  }
}

export function timelogNode(overrides: TimelogNodeOverrides = {}) {
  nextId += 1

  return {
    id: `gid://gitlab/Timelog/${String(nextId)}`,
    spentAt: overrides.spentAt === undefined ? '2026-05-12T15:00:00Z' : overrides.spentAt,
    timeSpent: overrides.timeSpent ?? 24_120,
  }
}

/** `totalSpentTime` is a `BigInt`, which GraphQL serialises as a string. */
function declaredNode(declared: { entryCount: number; seconds: number }) {
  return { count: declared.entryCount, totalSpentTime: String(declared.seconds) }
}

/** One person's node. Only the first round carries the aggregates. */
function personNode(one: PersonPayload, aggregated: boolean) {
  const declared = one.declared === undefined ? { entryCount: 1, seconds: 24_120 } : one.declared

  return {
    ...userNode(one.person),
    timelogs: {
      nodes: one.nodes ?? [timelogNode()],
      pageInfo: {
        endCursor: one.cursor ?? 'eyJzcGVudF9hdCI6IjIwMjYtMDUtMTIifQ',
        hasNextPage: one.more ?? false,
      },
      ...(aggregated && declared !== null ? declaredNode(declared) : {}),
    },
  }
}

function userNode(person: Person): UserNode {
  return { id: person.id, name: person.name, username: person.username, webUrl: person.webUrl }
}
