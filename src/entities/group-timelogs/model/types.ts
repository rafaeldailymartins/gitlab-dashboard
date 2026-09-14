import type { IsoDate, Weekday } from '@/shared/lib/date'

/** An inclusive run of calendar days. */
export interface DateRange {
  readonly from: IsoDate
  readonly to: IsoDate
}

/**
 * How much access the reader has to the group.
 *
 * It is here because it is the only thing that can turn "some hours are hidden
 * from you" into something the reader can act on. Null when the provider would
 * not say.
 */
export interface GroupAccess {
  /** GitLab's numeric access level: 0, 10, 15, 20, 30, 40 or 50. */
  readonly level: number
  /** GitLab's own name for it — `GUEST`, `PLANNER`, `REPORTER`, and so on. */
  readonly name: string
}

/** The group a report is about. */
export interface GroupRef {
  readonly fullPath: string
  /** The group's own name. Falls back to its path when the provider withholds it. */
  readonly name: string
}

/**
 * One timelog read from a group, normalised.
 *
 * No project and no work item: the matrix needs neither, and not asking for
 * `Timelog.project` — which is non-nullable while the connection's items are
 * not — removes an entire class of withheld entry before it can happen.
 */
export interface GroupTimelogEntry {
  /** GitLab's global id, so two answers about the same page can be reconciled. */
  readonly id: string
  readonly person: Person
  /** Whole seconds. Negative values correct a mistaken entry. */
  readonly seconds: number
  /** An instant. Which day it belongs to is decided in the reader's zone. */
  readonly spentAt: Date
}

/** A total over a set of entries. Accumulated in seconds, converted once. */
export interface PeriodTotal {
  readonly entryCount: number
  readonly hours: number
  readonly seconds: number
}

/** Who logged the time. */
export interface Person {
  /** GitLab's global user id. A username can be changed; this cannot. */
  readonly id: string
  readonly name: string
  readonly username: string
  readonly webUrl: string
}

/**
 * How many hours a full day is, per ISO weekday.
 *
 * A constant this app states on screen rather than a claim about anybody's
 * contract. It is a parameter so the rules can be exercised against any
 * schedule, and so the one the screen uses is a value a test can pin.
 */
export type ReferenceSchedule = Readonly<Record<Weekday, number>>

/**
 * Somebody the group lists as a member, and the access they hold.
 *
 * `active` and `bot` are carried rather than filtered at the boundary so the
 * rule that drops them is a rule a test can exercise, not an adapter detail.
 */
export interface RosterMember {
  readonly access: GroupAccess | null
  /** False for a blocked, deactivated or banned account. */
  readonly active: boolean
  readonly bot: boolean
  readonly person: Person
}

/**
 * Eight hours Monday to Friday, nothing at the weekend.
 *
 * The screen names this in its legend. The alternative — measuring colleagues
 * against the reader's own configured target — would draw a part-time
 * teammate's every day as visibly short, which is an assertion about somebody
 * else's working arrangement that this app has no basis for making.
 */
export const REFERENCE_SCHEDULE: ReferenceSchedule = {
  1: 8,
  2: 8,
  3: 8,
  4: 8,
  5: 8,
  6: 0,
  7: 0,
}
