import { addDays, earlierOf, type IsoDate, toIsoDate } from '@/shared/lib/date'
import { secondsToHours } from '@/shared/lib/duration'

import type { Granularity } from './columns'
import type { MemberWindow, Shortfall, TeamGrid } from './grid'
import type { MemberIdentity } from './identity'
import type { DeclaredTotals, TeamHoursPage } from './ports'
import type { Member, PeriodTotal, Person, ReferenceSchedule, TeamTimelogEntry } from './types'
import type { ReaderWindow } from './window'

import { shortfallOf, teamGrid } from './grid'
import { identityLookup } from './identity'

export interface ReportOptions {
  readonly granularity: Granularity
  /** The team, in the order it names them; the screen orders the rows itself. */
  readonly members: readonly Member[]
  readonly reference: ReferenceSchedule
  readonly timeZone: string
  readonly today: IsoDate
  readonly window: ReaderWindow
}

/** Everything the screen needs, derived from what has been read so far. */
export interface TeamReport {
  /**
   * True once every person's window has been read to its end.
   *
   * A row does not wait on this: each person is their own connection, so one
   * whose month fitted a page is final while another is still being read. This
   * is only what the figure over the whole team waits on.
   */
  readonly complete: boolean
  /** What the provider says the window holds, summed over the team. */
  readonly declared: DeclaredTotals
  readonly grid: TeamGrid
  /** Signed, over the whole team. Null before every person has been read. */
  readonly shortfall: null | Shortfall
  /** What was read and can be shown. */
  readonly visible: PeriodTotal
}

/** One person's answer, gathered across every round that carried them. */
interface Gathered {
  readonly declared: DeclaredTotals | null
  readonly entries: readonly TeamTimelogEntry[]
  readonly nextCursor: null | string
  readonly person: Person
}

const NOTHING_DECLARED: DeclaredTotals = { entryCount: 0, seconds: 0 }

/**
 * The report as the rounds read so far describe it.
 *
 * The team total is deliberately not the independent measurement the group
 * report's was. There is no aggregate over "a set of people" to ask the provider
 * for, so this is the per-person declarations added up — which means the figure
 * over the whole team is exactly the sum of the rows and can no longer catch a
 * discrepancy between them. Nothing was lost that could have been kept.
 */
export function teamReportFrom(
  pages: readonly TeamHoursPage[],
  options: ReportOptions,
): TeamReport {
  const gathered = gather(pages)
  const identityOf = identityLookup([...gathered.values()].map((one) => one.person))
  const windows = windowsOf(gathered, identityOf, options)
  const complete = options.members.every((member) => isSettled(gathered.get(member.id)))
  const visible = visibleTotalOf(windows)
  const declared = declaredOver(windows)

  return {
    complete,
    declared,
    grid: gridOf(windows, options),
    shortfall: complete ? shortfallOf(declared, visible) : null,
    visible,
  }
}

/** Every person's declaration, added up. Nobody's is an absence, not a zero. */
function declaredOver(windows: readonly MemberWindow[]): DeclaredTotals {
  if (windows.every((one) => one.declared === null)) {
    return NOTHING_DECLARED
  }

  return {
    entryCount: windows.reduce((sum, one) => sum + (one.declared?.entryCount ?? 0), 0),
    seconds: windows.reduce((sum, one) => sum + (one.declared?.seconds ?? 0), 0),
  }
}

/**
 * The last day every entry of which has certainly been read, for one person.
 *
 * Entries arrive oldest first, so the newest one read marks the frontier — and
 * the frontier is the day *before* it, because the next round can still carry
 * more entries for that same day. Null until something has been read: nothing
 * can be said about any day yet.
 */
function frontierOf(
  entries: readonly TeamTimelogEntry[],
  settled: boolean,
  options: ReportOptions,
): IsoDate | null {
  const { period } = options.window

  if (settled) {
    return period.to
  }

  const newest = entries.at(-1)

  return newest
    ? earlierOf(addDays(toIsoDate(newest.spentAt, options.timeZone), -1), period.to)
    : null
}

/** Each person's rounds folded into one answer, keyed by the provider's id. */
function gather(pages: readonly TeamHoursPage[]): Map<string, Gathered> {
  const byId = new Map<string, Gathered>()

  for (const page of pages) {
    for (const answer of page.members) {
      const seen = byId.get(answer.person.id)

      byId.set(answer.person.id, {
        // Only the first round carries the aggregates: they are window-wide, so
        // asking again would return the same number at a later instant, and an
        // aggregate read later than the page it is compared against can differ
        // for reasons that are not redaction.
        declared: seen?.declared ?? answer.declared,
        entries: [...(seen?.entries ?? []), ...answer.entries],
        nextCursor: answer.nextCursor,
        person: answer.person,
      })
    }
  }

  return byId
}

function gridOf(windows: readonly MemberWindow[], options: ReportOptions): TeamGrid {
  return teamGrid({
    granularity: options.granularity,
    members: windows,
    period: options.window.period,
    reference: options.reference,
    timeZone: options.timeZone,
    today: options.today,
  })
}

/**
 * Whether one person's window has been read to its end.
 *
 * Somebody the provider never resolved is settled: nothing more is coming for
 * them, and holding the report open on an answer that will never arrive would
 * mark every figure provisional forever.
 */
function isSettled(gathered: Gathered | undefined): boolean {
  return (gathered?.nextCursor ?? null) === null
}

/** What the reader was shown across the whole widened window, uncut. */
function visibleTotalOf(windows: readonly MemberWindow[]): PeriodTotal {
  const entries = windows.flatMap((one) => one.entries)
  const seconds = entries.reduce((sum, entry) => sum + entry.seconds, 0)

  return { entryCount: entries.length, hours: secondsToHours(seconds), seconds }
}

/** One slice of the window per person the team names, in the order it names them. */
function windowsOf(
  gathered: ReadonlyMap<string, Gathered>,
  identityOf: (member: Member) => MemberIdentity,
  options: ReportOptions,
): readonly MemberWindow[] {
  return options.members.map((member) => {
    const answer = gathered.get(member.id)
    const entries = answer?.entries ?? []

    return {
      declared: answer?.declared ?? null,
      entries,
      identity: identityOf(member),
      loadedThrough: frontierOf(entries, isSettled(answer), options),
      member,
    }
  })
}
