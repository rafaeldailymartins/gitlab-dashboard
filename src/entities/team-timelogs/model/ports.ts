import type { GroupRef, Member, Person, SuggestedMember, TeamTimelogEntry } from './types'

/** One person's period as the provider declares it, column by column. */
export interface ColumnProbeAnswer {
  readonly byColumn: ReadonlyMap<string, DeclaredTotals>
  readonly period: DeclaredTotals
}

/** What to ask about one person, column by column. */
export interface ColumnProbeQuery {
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
  /** The group the figures are narrowed to, or null for the reader's whole reach. */
  readonly groupId: null | string
  /** The provider's own identifier for the person. */
  readonly memberId: string
  readonly to: string
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

/** Where one person's reading left off, for the round that continues it. */
export interface MemberCursor {
  readonly cursor: string
  readonly memberId: string
}

/** One person's answer within one round. */
export interface MemberHours {
  /**
   * The window's aggregates, on the first round only.
   *
   * Null on a continuation: they are window-wide rather than page-wide, so
   * asking again would re-run a count and a sum over the whole month for the
   * same number.
   */
  readonly declared: DeclaredTotals | null
  readonly entries: readonly TeamTimelogEntry[]
  /** Pass to the next round. Null when there is nothing after this. */
  readonly nextCursor: null | string
  /** Who the provider resolved for the identifier it was asked about. */
  readonly person: Person
}

/** Whoever logged, and whether the reading reached the end of them. */
export interface SuggestionAnswer {
  /** True when the cap was reached before the provider ran out of entries. */
  readonly partial: boolean
  readonly people: readonly SuggestedMember[]
}

/** Which group to read, and over what window. */
export interface SuggestionQuery {
  readonly from: string
  readonly fullPath: string
  readonly to: string
}

/** Where every still-unfinished person left off. */
export interface TeamFollowingQuery {
  readonly cursors: readonly MemberCursor[]
  readonly from: string
  readonly groupId: null | string
  readonly to: string
}

/** One round of reading: whoever the provider resolved, and what they logged. */
export interface TeamHoursPage {
  readonly members: readonly MemberHours[]
}

/** Who to ask about, over which window, and how far to narrow it. */
export interface TeamHoursQuery {
  readonly from: string
  /**
   * The group the figures are narrowed to, or null.
   *
   * It must be threaded through here, through the aggregates on the same
   * connection, and through the column probe, or through none of them: an
   * instrument measuring a different set than the figures makes every shortfall
   * on the screen nonsense, and does it silently, because both numbers would
   * look reasonable.
   */
  readonly groupId: null | string
  readonly members: readonly Member[]
  readonly to: string
}

/** Everything the report needs from a time-tracking provider about a team. */
export interface TeamTimelogGateway {
  /** What one person logged in each column, and what was withheld from it. */
  columns(query: ColumnProbeQuery, signal?: AbortSignal): Promise<ColumnProbeAnswer>
  /** The rest of the window, for whoever's first round did not hold it. */
  following(query: TeamFollowingQuery, signal?: AbortSignal): Promise<TeamHoursPage>
  /** One group by its path, or null when this reader cannot open it. */
  group(fullPath: string, signal?: AbortSignal): Promise<GroupRef | null>
  /** Groups the reader is authorized in, for the filter and for seeding a team. */
  groups(search: null | string, signal?: AbortSignal): Promise<readonly GroupRef[]>
  /** People the provider can find by name or handle, for adding one at a time. */
  people(search: string, signal?: AbortSignal): Promise<readonly Person[]>
  /** Whoever logged time in a group over the window, as candidates for a team. */
  suggestions(query: SuggestionQuery, signal?: AbortSignal): Promise<SuggestionAnswer>
  /** The first round: every person's window, their aggregates, and who resolved. */
  timelogs(query: TeamHoursQuery, signal?: AbortSignal): Promise<TeamHoursPage>
}
