import type { GroupTimelogEntry, Person, RosterMember } from '@/entities/group-timelogs'

/**
 * Fixtures for a group's timelogs, shaped from a real `group.timelogs` response
 * recorded from gitlab.com while designing the query.
 *
 * The global-id forms, the `totalSpentTime` **string**, the nullable node and
 * the instant format are all exactly what GitLab sends. A fixture that agreed
 * with our own schema but not with GitLab's would pass while the app failed —
 * which is the reason the personal fixtures beside this file are shaped the same
 * way.
 */
export const SQUAD_FISCAL = {
  fullPath: 'invent-software/invent-apps-2/squad-fiscal',
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

/** A person the group no longer lists, who logged time inside the month. */
export const DIEGO: Person = {
  id: 'gid://gitlab/User/2318745',
  name: 'Diego Alves Prado',
  username: 'diego.prado',
  webUrl: 'https://gitlab.com/diego.prado',
}

const REPORTER = { level: 20, name: 'REPORTER' }

let nextId = 13_709_983

interface MemberNodeOverrides {
  bot?: boolean
  state?: string
}

interface PagePayloadOverrides {
  endCursor?: null | string
  group?: null
  hasNextPage?: boolean
  nodes?: unknown[]
}

// ---------------------------------------------------------------- raw payloads

interface ProbePayloadOverrides {
  entryCount?: number
  perPerson?: readonly { person: Person; seconds: number }[]
  seconds?: number
}

interface RosterPayloadOverrides {
  endCursor?: null | string
  hasNextPage?: boolean
  nodes?: unknown[]
}

interface TimelogNodeOverrides {
  spentAt?: null | string
  timeSpent?: number
  user?: null | UserNode
}

interface UserNode {
  id: string
  name: string
  username: string
  webUrl: string
}

/** One normalised entry. Ids are distinct so a reconciliation can tell them apart. */
export function entry(person: Person, spentAt: string, seconds: number): GroupTimelogEntry {
  nextId += 1

  return {
    id: `gid://gitlab/Timelog/${String(nextId)}`,
    person,
    seconds,
    spentAt: new Date(spentAt),
  }
}

/** A `GroupHoursPage` answer, defaulting to one page that ends the window. */
export function groupHoursPayload(overrides: PagePayloadOverrides = {}) {
  if (overrides.group === null) {
    return { group: null }
  }

  return {
    group: {
      fullPath: SQUAD_FISCAL.fullPath,
      name: SQUAD_FISCAL.name,
      timelogs: {
        nodes: overrides.nodes ?? [timelogNode()],
        pageInfo: {
          endCursor: overrides.endCursor ?? 'eyJzcGVudF9hdCI6IjIwMjYtMDUtMTIifQ',
          hasNextPage: overrides.hasNextPage ?? false,
        },
      },
    },
  }
}

/** The reader's authorized groups, for the picker. */
export function groupsPayload() {
  return { groups: { nodes: [{ fullPath: SQUAD_FISCAL.fullPath, name: SQUAD_FISCAL.name }] } }
}

/** One member of the roster. Active and human unless told otherwise. */
export function member(person: Person, overrides: Partial<RosterMember> = {}): RosterMember {
  return { access: REPORTER, active: true, bot: false, person, ...overrides }
}

export function memberNode(person: Person, overrides: MemberNodeOverrides = {}) {
  return {
    accessLevel: { integerValue: REPORTER.level, stringValue: REPORTER.name },
    user: { ...userNode(person), bot: overrides.bot ?? false, state: overrides.state ?? 'active' },
  }
}

/** A `GroupMonthProbe` answer: the window's aggregates and each person's own. */
export function probePayload(overrides: ProbePayloadOverrides = {}) {
  const perPerson = overrides.perPerson ?? [{ person: ANA, seconds: 167_400 }]
  const aliases = Object.fromEntries(
    perPerson.map(({ person, seconds }, index) => [
      `p${String(index)}`,
      { count: 1, totalSpentTime: String(seconds), username: person.username },
    ]),
  )

  return {
    group: {
      fullPath: SQUAD_FISCAL.fullPath,
      maxAccessLevel: { integerValue: REPORTER.level, stringValue: REPORTER.name },
      name: SQUAD_FISCAL.name,
      window: {
        count: overrides.entryCount ?? 1,
        totalSpentTime: String(overrides.seconds ?? 167_400),
      },
      ...aliases,
    },
  }
}

/**
 * A page GitLab redacted: `count` and `totalSpentTime` describe more than the
 * nodes hold.
 *
 * This is the shape the whole shortfall apparatus exists for, and it carries no
 * error and no null — the entries are simply not in the array.
 */
export function redactedProbePayload() {
  return probePayload({ entryCount: 40, seconds: 500_000 })
}

/** A `GroupRoster` answer. */
export function rosterPayload(overrides: RosterPayloadOverrides = {}) {
  return {
    group: {
      fullPath: SQUAD_FISCAL.fullPath,
      groupMembers: {
        nodes: overrides.nodes ?? [memberNode(ANA), memberNode(BRUNO), memberNode(CAMILA)],
        pageInfo: {
          endCursor: overrides.endCursor ?? 'MQ',
          hasNextPage: overrides.hasNextPage ?? false,
        },
      },
      maxAccessLevel: { integerValue: REPORTER.level, stringValue: REPORTER.name },
      name: SQUAD_FISCAL.name,
    },
  }
}

export function timelogNode(overrides: TimelogNodeOverrides = {}) {
  nextId += 1

  return {
    id: `gid://gitlab/Timelog/${String(nextId)}`,
    spentAt: '2026-05-12T15:00:00Z',
    timeSpent: 24_120,
    user: userNode(ANA),
    ...overrides,
  }
}

function userNode(person: Person): UserNode {
  return { id: person.id, name: person.name, username: person.username, webUrl: person.webUrl }
}
