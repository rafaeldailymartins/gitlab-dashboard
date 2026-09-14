import type { GroupAccess, GroupRef, GroupTimelogEntry, RosterMember } from './types'

/** One person's period as the provider declares it, column by column. */
export interface ColumnProbeAnswer {
  readonly byColumn: ReadonlyMap<string, DeclaredTotals>
  readonly period: DeclaredTotals
}

/** What to ask about one person, column by column. */
export interface ColumnProbeQuery extends GroupQuery {
  /**
   * One span per grid column, in the order the columns are in.
   *
   * Exact instants, not the widened window: a span that reached into its
   * neighbour would attribute the neighbour's withheld hours to it, and
   * placing an hour on a day it was not logged on is the one thing this is not
   * allowed to do. The answer is checked against the period before it is used.
   */
  readonly columns: readonly { from: string; key: string; to: string }[]
  /** The whole period, at the same exact instants. Used to check the spans. */
  readonly from: string
  readonly to: string
  readonly username: string
}

/**
 * What the connection says exists in the window, before it removed anything.
 *
 * The provider computes these in the database over the whole unpaginated
 * relation, while it removes the entries the reader may not read from the
 * answer itself — silently, with no null and no error. The difference between
 * the two is the only instrument that can see that removal, which is why this
 * is read at all.
 */
export interface DeclaredTotals {
  readonly entryCount: number
  readonly seconds: number
}

/** One page of a group's timelogs. */
export interface GroupHoursPage {
  readonly entries: readonly GroupTimelogEntry[]
  /** Null when the provider would not resolve the group for this reader. */
  readonly group: GroupRef | null
  /** Pass to the next request. Null when there is nothing after this page. */
  readonly nextCursor: null | string
}

/** What to ask for, and over which window. */
export interface GroupHoursQuery extends ProbeQuery {
  /** A cursor from a previous page, or null for the first one. */
  readonly after: null | string
}

/** The window's own arithmetic, read once rather than on every page. */
export interface GroupProbe {
  readonly access: GroupAccess | null
  readonly declared: DeclaredTotals
  readonly group: GroupRef | null
  /** One entry per person asked about, keyed by username. */
  readonly perPerson: ReadonlyMap<string, DeclaredTotals>
}

/** Which group to read. */
export interface GroupQuery {
  readonly fullPath: string
}

/** Everything the report needs from a time-tracking provider about a group. */
export interface GroupTimelogGateway {
  /** What one person logged in each column, and what was withheld from it. */
  columns(query: ColumnProbeQuery, signal?: AbortSignal): Promise<ColumnProbeAnswer>
  /** Groups the reader is authorized in, for the picker. */
  groups(search: null | string, signal?: AbortSignal): Promise<readonly GroupRef[]>
  /** The window's aggregates, the reader's access, and each person's own total. */
  probe(query: ProbeQuery, signal?: AbortSignal): Promise<GroupProbe>
  /** Every member of the group, read to exhaustion. */
  roster(query: GroupQuery, signal?: AbortSignal): Promise<RosterAnswer>
  /** One page of the window's entries, oldest first. */
  timelogs(query: GroupHoursQuery, signal?: AbortSignal): Promise<GroupHoursPage>
}

/** The window, plus who to ask about within it. */
export interface ProbeQuery extends GroupQuery {
  /** An ISO 8601 instant with an explicit offset. Inclusive. */
  readonly from: string
  /** An ISO 8601 instant with an explicit offset. Inclusive. */
  readonly to: string
  /** Usernames to ask a per-person total for. Empty asks only for the window. */
  readonly usernames?: readonly string[]
}

/** The group's membership, already read to exhaustion by the adapter. */
export interface RosterAnswer {
  readonly access: GroupAccess | null
  readonly group: GroupRef | null
  readonly members: readonly RosterMember[]
}
