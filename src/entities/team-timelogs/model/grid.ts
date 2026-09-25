import { type IsoDate, toIsoDate } from '@/shared/lib/date'
import { secondsToHours } from '@/shared/lib/duration'

import type { Granularity, GridColumn, WeekBand } from './columns'
import type { MemberIdentity } from './identity'
import type { DeclaredTotals } from './ports'
import type { DateRange, Member, PeriodTotal, ReferenceSchedule, TeamTimelogEntry } from './types'

import { columnsOf, weekBandsOf } from './columns'
import { entriesWithin } from './window'

/**
 * What a cell is, in the order the kinds are decided.
 *
 * `unknown` comes first: the provider said nothing about this person and never
 * will until the reader fixes the team, so there is no figure and none is
 * coming. `pending` comes next and beats even `logged`, because until a column
 * has been read to its end more entries may still land in it. Everything this
 * screen is for depends on never putting a figure that will change, or a figure
 * that was never measured, beside somebody's name.
 */
export type CellKind = 'future' | 'logged' | 'non-working' | 'pending' | 'unknown' | 'unlogged'

export interface GridCell {
  /**
   * Zero hours is not the same as no entry: an entry and its correction on one
   * day is a day that was worked and accounted for, and a day with neither is
   * not.
   */
  readonly entryCount: number
  readonly hours: number
  readonly key: string
  readonly kind: CellKind
  /**
   * What the reference expects across this cell's column. Zero expects nothing.
   *
   * Carried on the cell rather than looked up by key when it is needed: the
   * lookup would be by a key that is always present, and the fallback for the
   * key that never is would be a branch no test could honestly reach.
   */
  readonly referenceHours: number
  readonly seconds: number
  /**
   * Hours over what the reference expects, **unclamped**, or null when nothing
   * is expected. Unclamped so a day above the reference stays distinguishable
   * from one that exactly meets it; the interface decides how to draw the part
   * beyond one.
   */
  readonly share: null | number
}

export interface GridRequest {
  readonly granularity: Granularity
  /** One per person the team names, in the order their rows are drawn. */
  readonly members: readonly MemberWindow[]
  readonly period: DateRange
  readonly reference: ReferenceSchedule
  readonly timeZone: string
  readonly today: IsoDate
}

export interface GridRow {
  readonly cells: readonly GridCell[]
  readonly identity: MemberIdentity
  readonly member: Member
  /**
   * How much of `shortfall` has been attributed to a column, or null when the
   * question was never asked or the answer failed its checks.
   *
   * Not necessarily all of it: the shortfall is measured over the widened
   * window and the columns only cover the period, so an entry withheld on a
   * padding day is in the first and in no column. The interface reports what
   * is left over rather than assuming there is nothing.
   */
  readonly placed: null | Shortfall
  /**
   * What the provider says this person logged, minus what it showed. Signed,
   * and null when the provider was not asked about them. See `shortfallOf`.
   */
  readonly shortfall: null | Shortfall
  readonly total: PeriodTotal
}

/**
 * One person's slice of the window, as far as it has been read.
 *
 * `entries` is every entry read for them from the window the provider was asked
 * about — **not** cut to the period. The cut happens here, because the cells and
 * the shortfall need two different answers out of one set: the cells draw the
 * reader's month, and the shortfall is measured against what the provider
 * declared, which covers the whole window. Cutting before this point would
 * compare a month against a window and report every hour logged on the padding
 * days as an hour somebody had hidden from the reader.
 *
 * `loadedThrough` is **theirs**, not the report's. Each person's month is its
 * own connection, so one whose entries fitted a single page is settled while a
 * heavy logger is still being read — and holding every row at `pending` behind
 * the slowest of them is what the old shape had to do and this one does not.
 */
export interface MemberWindow {
  /** Null when the provider was not asked, which is not the same as zero. */
  readonly declared: DeclaredTotals | null
  readonly entries: readonly TeamTimelogEntry[]
  readonly identity: MemberIdentity
  /** The last day their read is complete through, or null when nothing has been. */
  readonly loadedThrough: IsoDate | null
  readonly member: Member
}

/**
 * The difference between what the provider says exists and what it showed.
 *
 * **Signed, never clamped.** A positive difference is hours missing from the
 * figures. A negative one means the figures are too high — which happens when a
 * correcting entry is one of the ones withheld, and is the direction no amount
 * of further reading can uncover. Reporting it as zero would turn "these
 * figures overstate somebody's month" into "nothing is missing".
 */
export interface Shortfall {
  readonly entryCount: number
  readonly hours: number
  readonly seconds: number
}

export interface TeamGrid {
  readonly columns: readonly GridColumn[]
  /** In `columns` order. */
  readonly columnTotals: readonly PeriodTotal[]
  readonly grandTotal: PeriodTotal
  readonly rows: readonly GridRow[]
  /** Empty under week columns, where every column is already a week. */
  readonly weeks: readonly WeekBand[]
}

/** What one person logged on one day, before it becomes a cell. */
interface DayTally {
  entryCount: number
  seconds: number
}

/** What a cell needs about the row it is in. */
interface RowContext {
  readonly identity: MemberIdentity
  readonly loadedThrough: IsoDate | null
  readonly today: IsoDate
}

/** A person with no entries in the window. Not the same as no answer at all. */
const NOTHING_VISIBLE: PeriodTotal = { entryCount: 0, hours: 0, seconds: 0 }

/**
 * What the provider says a person logged, minus what it showed of it.
 *
 * Null when the provider was not asked about them: "we did not check" and "we
 * checked and nothing is missing" are different facts, and a row that showed
 * the second when it meant the first would be the screen vouching for a figure
 * it never verified.
 */
export function shortfallOf(
  declared: DeclaredTotals | null | undefined,
  visible: PeriodTotal,
): null | Shortfall {
  if (!declared) {
    return null
  }

  const seconds = declared.seconds - visible.seconds

  return {
    entryCount: declared.entryCount - visible.entryCount,
    hours: secondsToHours(seconds),
    seconds,
  }
}

/**
 * The whole matrix: a row per person the team names, what each of them logged
 * in each column, and every total.
 *
 * Every total is accumulated in seconds and converted once. The grand total is
 * computed from the cells rather than by adding up the row or column figures,
 * so the bottom-right cell cannot drift from either of them by the rounding of
 * the figures on screen.
 *
 * Rows are exactly the team, in the order handed in. Nobody is added — the
 * provider was asked about these people and no others — and nobody is dropped,
 * because the reader chose each one and a row with nothing in it is the answer
 * they came for.
 */
export function teamGrid(request: GridRequest): TeamGrid {
  const columns = columnsOf(request.period, request.granularity, request.reference)
  const rows = request.members.map((member) => rowOf(member, columns, request))

  return {
    columns,
    columnTotals: totalsByColumn(rows, columns),
    grandTotal: totalOf(rows.flatMap((row) => row.cells)),
    rows,
    weeks: weekBandsOf(columns, request.granularity),
  }
}

/** Accumulated in seconds, converted once. */
export function totalOf(cells: readonly GridCell[]): PeriodTotal {
  const seconds = cells.reduce((sum, cell) => sum + cell.seconds, 0)

  return {
    entryCount: cells.reduce((sum, cell) => sum + cell.entryCount, 0),
    hours: secondsToHours(seconds),
    seconds,
  }
}

/**
 * Every column's cells, gathered by the column's own key.
 *
 * Keyed rather than indexed: reading `row.cells[index]` is `GridCell |
 * undefined` under `noUncheckedIndexedAccess`, which puts a branch in the
 * totals that no answer can reach and no honest test can cover.
 */
export function totalsByColumn(
  rows: readonly { cells: readonly GridCell[] }[],
  columns: readonly GridColumn[],
): PeriodTotal[] {
  const byKey = new Map<string, GridCell[]>()

  for (const cell of rows.flatMap((row) => row.cells)) {
    const gathered = byKey.get(cell.key) ?? []

    gathered.push(cell)
    byKey.set(cell.key, gathered)
  }

  return columns.map((column) => totalOf(byKey.get(column.key) ?? []))
}

/** What one person logged across one column. */
function cellOf(column: GridColumn, days: Map<IsoDate, DayTally>, context: RowContext): GridCell {
  const logged = sumOver(column, days)
  const share =
    column.referenceHours === 0 ? null : secondsToHours(logged.seconds) / column.referenceHours

  return {
    ...logged,
    hours: secondsToHours(logged.seconds),
    key: column.key,
    kind: kindOf(column, logged.entryCount, context),
    referenceHours: column.referenceHours,
    share,
  }
}

/**
 * Which kind a cell is.
 *
 * Read as a ladder. Nothing at all can be said about somebody the provider would
 * not resolve; nothing can be said about a column that has not been read to its
 * end; a column with entries is what it holds; a column later than today is not
 * one anybody failed to log; a column the reference expects nothing of is not
 * either; what is left is a day somebody was expected to log and did not, which
 * is the fact this screen exists to show.
 */
function kindOf(column: GridColumn, entryCount: number, context: RowContext): CellKind {
  if (context.identity.kind !== 'confirmed') {
    return 'unknown'
  }

  if (context.loadedThrough === null || column.to > context.loadedThrough) {
    return 'pending'
  }

  if (entryCount > 0) {
    return 'logged'
  }

  if (column.from > context.today) {
    return 'future'
  }

  return column.referenceHours === 0 ? 'non-working' : 'unlogged'
}

/** Seconds and entries per day, the one instant-to-day conversion. */
function ledgerOf(entries: readonly TeamTimelogEntry[], timeZone: string): Map<IsoDate, DayTally> {
  const days = new Map<IsoDate, DayTally>()

  for (const entry of entries) {
    const date = toIsoDate(entry.spentAt, timeZone)
    const day = days.get(date) ?? { entryCount: 0, seconds: 0 }

    days.set(date, { entryCount: day.entryCount + 1, seconds: day.seconds + entry.seconds })
  }

  return days
}

/**
 * One person's row: the month its cells draw, and how much of the window they
 * were not shown.
 *
 * The two are measured over different spans on purpose. `total` is the month,
 * because that is what the cells beside it add up to. The shortfall compares
 * what the provider declared against what it actually handed over — and it
 * declared over the window it was asked about, which is the month widened by a
 * day at each end. Comparing that declaration against the month instead would
 * count every hour logged on 31 August as an hour withheld from September.
 */
function rowOf(
  window: MemberWindow,
  columns: readonly GridColumn[],
  request: GridRequest,
): GridRow {
  const drawn = entriesWithin(window.entries, request.period, request.timeZone)
  const days = ledgerOf(drawn, request.timeZone)
  const context: RowContext = {
    identity: window.identity,
    loadedThrough: window.loadedThrough,
    today: request.today,
  }
  const cells = columns.map((column) => cellOf(column, days, context))

  return {
    cells,
    identity: window.identity,
    member: window.member,
    placed: null,
    shortfall: shortfallOf(window.declared, visibleOf(window.entries)),
    total: totalOf(cells),
  }
}

/** What one person logged inside one column's span. */
function sumOver(column: GridColumn, days: Map<IsoDate, DayTally>): DayTally {
  let entryCount = 0
  let seconds = 0

  for (const [date, day] of days) {
    if (date >= column.from && date <= column.to) {
      entryCount += day.entryCount
      seconds += day.seconds
    }
  }

  return { entryCount, seconds }
}

/** What the reader was shown across the whole window, uncut. */
function visibleOf(entries: readonly TeamTimelogEntry[]): PeriodTotal {
  if (entries.length === 0) {
    return NOTHING_VISIBLE
  }

  const seconds = entries.reduce((sum, entry) => sum + entry.seconds, 0)

  return { entryCount: entries.length, hours: secondsToHours(seconds), seconds }
}
