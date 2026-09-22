import type { IsoDate, Weekday } from '@/shared/lib/date'

/** An inclusive run of calendar days. */
export interface DateRange {
  readonly from: IsoDate
  readonly to: IsoDate
}

/** The group a report may be narrowed to, and the picker offers. */
export interface GroupRef {
  readonly fullPath: string
  /** The provider's own identifier. It is what `timelogs(groupId:)` takes. */
  readonly id: string
  /** The group's own name. Falls back to its path when the provider withholds it. */
  readonly name: string
}

/**
 * Somebody a team names, as the report is handed them.
 *
 * Structurally what `entities/teams` stores, declared again here rather than
 * imported: FSD forbids one entity slice reaching into another, and a
 * three-field shape is not worth a cross-import to share. The page composes the
 * two, and TypeScript's structural typing means no mapper is needed.
 *
 * No `webUrl`: that belongs to a person the provider resolved, not to a name
 * the reader stored.
 */
export interface Member {
  readonly id: string
  readonly name: string
  readonly username: string
}

/** A total over a set of entries. Accumulated in seconds, converted once. */
export interface PeriodTotal {
  readonly entryCount: number
  readonly hours: number
  readonly seconds: number
}

/** Who the provider resolved, and what it says about them now. */
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
 * Somebody who logged time in a group, offered as a candidate for a team.
 *
 * `active` and `bot` are carried rather than filtered at the boundary so the
 * rule that drops one of them is a rule a test can exercise, not an adapter
 * detail. They decide something here and nowhere else: a bot has no timesheet
 * anybody manages, while an account that is no longer active but logged time in
 * the window is somebody who did the work and has since left.
 *
 * Nothing on screen renders `active` any more. A team is built from a group in
 * one action rather than picked out of a list of candidates one name at a time,
 * so there is no candidate to mark. It is kept because it is what makes "an
 * inactive account is not dropped" a claim a test can fail on — without it the
 * rule would be true only for as long as nobody writes the filter.
 */
export interface SuggestedMember {
  /** False for a blocked, deactivated or banned account. */
  readonly active: boolean
  readonly bot: boolean
  readonly person: Person
}

/**
 * One timelog, normalised.
 *
 * No person: an entry arrives under the node of whoever logged it, so who it
 * belongs to is known by where it is rather than repeated on every one of them.
 *
 * No project and no work item: the matrix needs neither, and not asking for
 * `Timelog.project` — which is non-nullable while the connection's items are
 * not — removes an entire class of withheld entry before it can happen.
 */
export interface TeamTimelogEntry {
  /** GitLab's global id, so two answers about the same page can be reconciled. */
  readonly id: string
  /** Whole seconds. Negative values correct a mistaken entry. */
  readonly seconds: number
  /** An instant. Which day it belongs to is decided in the reader's zone. */
  readonly spentAt: Date
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
