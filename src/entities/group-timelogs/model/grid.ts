import { type IsoDate, toIsoDate } from '@/shared/lib/date'
import { secondsToHours } from '@/shared/lib/duration'

import type { Granularity, GridColumn, WeekBand } from './columns'
import type { DeclaredTotals } from './ports'
import type {
  DateRange,
  GroupTimelogEntry,
  PeriodTotal,
  Person,
  ReferenceSchedule,
  RosterMember,
} from './types'

import { columnsOf, weekBandsOf } from './columns'
import { people } from './roster'
import { entriesWithin } from './window'

/**
 * What a cell is, in the order the kinds are decided.
 *
 * `pending` comes first and beats even `logged`: until a column has been read
 * to its end, more entries may still land in it, so any figure shown there is a
 * number that will change. Everything this screen is for depends on never
 * putting a figure that will change beside somebody's name.
 */
export type CellKind = 'future' | 'logged' | 'non-working' | 'pending' | 'unlogged'

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
  /**
   * Every entry read from the window the provider was asked about — **not**
   * cut to `period`. The cut happens here, because the cells and the
   * per-person shortfall need two different answers out of one set: the cells
   * draw the reader's month, and the shortfall is measured against what the
   * provider declared, which covers the whole window. Handing this in already
   * cut would compare a month against a window and report every hour logged
   * on the padding days as an hour somebody had hidden from the reader.
   */
  readonly entries: readonly GroupTimelogEntry[]
  readonly granularity: Granularity
  /**
   * The last day the read is known to be complete through, or null when nothing
   * has been read. Everything after it is `pending`.
   */
  readonly loadedThrough: IsoDate | null
  readonly period: DateRange
  /**
   * What the provider says each person logged in the window, by username.
   *
   * Absent for a person it was not asked about, which is not the same as zero.
   */
  readonly perPerson: ReadonlyMap<string, DeclaredTotals>
  readonly reference: ReferenceSchedule
  readonly roster: readonly RosterMember[]
  readonly timeZone: string
  readonly today: IsoDate
}

export interface GridRow {
  readonly cells: readonly GridCell[]
  /** False for somebody who logged time here but is not on the membership. */
  readonly onRoster: boolean
  readonly person: Person
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

/** A person with no entries in the window. Not the same as no answer at all. */
const NOTHING_VISIBLE: PeriodTotal = { entryCount: 0, hours: 0, seconds: 0 }

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

/** Seconds logged, per person id, per calendar day. */
type Ledger = Map<string, Map<IsoDate, DayTally>>

/**
 * What the provider says a person logged, minus what it showed of it.
 *
 * Null when the provider was not asked about them: "we did not check" and "we
 * checked and nothing is missing" are different facts, and a row that showed
 * the second when it meant the first would be the screen vouching for a figure
 * it never verified.
 */
export function shortfallOf(
  declared: DeclaredTotals | undefined,
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
 * The whole matrix: who has a row, what each of them logged on each column, and
 * every total.
 *
 * Every total is accumulated in seconds and converted once. The grand total is
 * computed from the ledger rather than by adding up the row or column figures,
 * so the bottom-right cell cannot drift from either of them by the rounding of
 * the figures on screen.
 *
 * The entries are cut to the period once, here, and everything drawn comes from
 * the cut: the cells, the roster union — somebody who logged only in the padding
 * days did not work in this month — and every total on screen. Only the
 * shortfall reads the uncut set, because only the shortfall is a comparison
 * against a figure the provider computed over the window it was asked about.
 */
export function teamGrid(request: GridRequest): TeamGrid {
  const columns = columnsOf(request.period, request.granularity, request.reference)
  const drawn = entriesWithin(request.entries, request.period, request.timeZone)
  const ledger = ledgerOf(drawn, request.timeZone)
  const rows = people(request.roster, drawn).map((row) => ({
    ...row,
    cells: columns.map((column) => cellOf(column, ledger.get(row.person.id), request)),
  }))
  const measured = visibleByPerson(request.entries)

  return {
    columns,
    columnTotals: totalsByColumn(rows, columns),
    grandTotal: totalOf(rows.flatMap((row) => row.cells)),
    rows: rows.map((row) => withTotals(row, request.perPerson, measured)),
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
function cellOf(
  column: GridColumn,
  days: Map<IsoDate, DayTally> | undefined,
  request: GridRequest,
): GridCell {
  const logged = sumOver(column, days)
  const share =
    column.referenceHours === 0 ? null : secondsToHours(logged.seconds) / column.referenceHours

  return {
    ...logged,
    hours: secondsToHours(logged.seconds),
    key: column.key,
    kind: kindOf(column, logged.entryCount, request),
    referenceHours: column.referenceHours,
    share,
  }
}

/**
 * Which kind a cell is.
 *
 * Read as a ladder: nothing can be said about a column that has not been read
 * to its end; a column with entries is what it holds; a column later than today
 * is not one anybody failed to log; a column the reference expects nothing of is
 * not either; what is left is a day somebody was expected to log and did not,
 * which is the fact this screen exists to show.
 */
function kindOf(column: GridColumn, entryCount: number, request: GridRequest): CellKind {
  if (request.loadedThrough === null || column.to > request.loadedThrough) {
    return 'pending'
  }

  if (entryCount > 0) {
    return 'logged'
  }

  if (column.from > request.today) {
    return 'future'
  }

  return column.referenceHours === 0 ? 'non-working' : 'unlogged'
}

/** Seconds and entries per person per day, the one instant-to-day conversion. */
function ledgerOf(entries: readonly GroupTimelogEntry[], timeZone: string): Ledger {
  const ledger: Ledger = new Map()

  for (const entry of entries) {
    const days = ledger.get(entry.person.id) ?? new Map<IsoDate, DayTally>()
    const date = toIsoDate(entry.spentAt, timeZone)
    const day = days.get(date) ?? { entryCount: 0, seconds: 0 }

    days.set(date, { entryCount: day.entryCount + 1, seconds: day.seconds + entry.seconds })
    ledger.set(entry.person.id, days)
  }

  return ledger
}

/** What one person logged inside one column's span. */
function sumOver(column: GridColumn, days: Map<IsoDate, DayTally> | undefined): DayTally {
  let entryCount = 0
  let seconds = 0

  for (const [date, day] of days ?? []) {
    if (date >= column.from && date <= column.to) {
      entryCount += day.entryCount
      seconds += day.seconds
    }
  }

  return { entryCount, seconds }
}

/**
 * What each person logged across the whole window, keyed by username.
 *
 * Keyed by username because that is the key the provider was asked by:
 * `timelogs(username:)` is what makes a declared total belong to one row.
 */
function visibleByPerson(entries: readonly GroupTimelogEntry[]): Map<string, PeriodTotal> {
  const tallies = new Map<string, DayTally>()

  for (const entry of entries) {
    const tally = tallies.get(entry.person.username) ?? { entryCount: 0, seconds: 0 }

    tallies.set(entry.person.username, {
      entryCount: tally.entryCount + 1,
      seconds: tally.seconds + entry.seconds,
    })
  }

  return new Map(
    [...tallies].map(([username, tally]) => [
      username,
      { ...tally, hours: secondsToHours(tally.seconds) },
    ]),
  )
}

/**
 * The row's own figures: the month it draws, and how much of the window it was
 * not shown.
 *
 * The two are measured over different spans on purpose. `total` is the month,
 * because that is what the cells beside it add up to. The shortfall compares
 * what the provider declared against what it actually handed over — and it
 * declared over the window it was asked about, which is the month widened by a
 * day at each end. Comparing that declaration against the month instead would
 * count every hour logged on 31 August as an hour withheld from September.
 */
function withTotals(
  row: { cells: readonly GridCell[]; onRoster: boolean; person: Person },
  perPerson: ReadonlyMap<string, DeclaredTotals>,
  measured: ReadonlyMap<string, PeriodTotal>,
): GridRow {
  const visible = measured.get(row.person.username) ?? NOTHING_VISIBLE

  return {
    ...row,
    placed: null,
    shortfall: shortfallOf(perPerson.get(row.person.username), visible),
    total: totalOf(row.cells),
  }
}
