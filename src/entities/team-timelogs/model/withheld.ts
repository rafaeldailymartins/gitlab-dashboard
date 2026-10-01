import { secondsToHours } from '@/shared/lib/duration'

import type { GridCell, GridRow, Shortfall, TeamGrid } from './grid'
import type { DeclaredTotals } from './ports'

import { totalOf, totalsByColumn } from './grid'

/**
 * What the provider says one person logged, column by column.
 *
 * The same instrument the row shortfall already uses — `count` and
 * `totalSpentTime` over a filtered relation — asked once per column instead of
 * once per month. It is the only way to learn which day a withheld entry
 * belongs to: the entry itself is removed from the answer, with no id, no
 * `spentAt` and no gap where it used to be.
 */
export interface WithheldDeclaration {
  /** Declared totals by grid column key. A missing column declares nothing. */
  readonly byColumn: ReadonlyMap<string, DeclaredTotals>
  /** The same person over the whole period, asked at the same instants. */
  readonly period: DeclaredTotals
}

/**
 * The part of a row's shortfall that has no column of its own.
 *
 * The whole of it when nothing was placed, and what is left when something was.
 * Not usually zero even after a successful placement: the shortfall is measured
 * over the widened window and the columns only cover the period, so an entry
 * withheld on a padding day is counted in the first and belongs to none of the
 * second. The interface says so rather than quietly rounding it away.
 */
export function unplacedOf(row: GridRow): null | Shortfall {
  if (row.shortfall === null) {
    return null
  }

  if (row.placed === null) {
    return row.shortfall
  }

  const seconds = row.shortfall.seconds - row.placed.seconds

  return {
    entryCount: row.shortfall.entryCount - row.placed.entryCount,
    hours: secondsToHours(seconds),
    seconds,
  }
}

/**
 * The grid again, with each person's withheld hours **added into** the column
 * they were logged in.
 *
 * A cell that reads 11 where the pages carried 8 is reading the provider's own
 * figure for that day: the aggregate it computes before removing what this
 * reader may not open. That is the more useful number for the question this
 * screen is opened with — did this person's day add up — and it is the more
 * correct one.
 *
 * Every total is rebuilt from the summed cells, so the row totals, the column
 * totals and the corner still agree with one another and with the figures above
 * them. A screen whose parts add up is the one thing here worth more than the
 * hours themselves.
 *
 * A row is only rewritten when its declaration survives three checks, all on
 * entry counts rather than on seconds, because a count cannot cancel: an entry
 * and its correction net to zero seconds while remaining two entries. A
 * declaration that fails one changes nothing at all, and the row falls back to
 * saying hours are missing without saying where — which is worse than this, and
 * far better than a number moved to a day it was never logged on.
 */
export function withWithheld(
  grid: TeamGrid,
  declarations: ReadonlyMap<string, WithheldDeclaration>,
): TeamGrid {
  const rows = grid.rows.map((row) => placedRow(row, declarations.get(row.member.id)))

  return {
    ...grid,
    columnTotals: totalsByColumn(rows, grid.columns),
    grandTotal: totalOf(rows.flatMap((row) => row.cells)),
    rows,
  }
}

/** Every column's declaration, added up. */
function declaredOver(declaration: WithheldDeclaration): number {
  return [...declaration.byColumn.values()].reduce((sum, column) => sum + column.entryCount, 0)
}

/** What was drawn in the row, added up. */
function drawnOver(cells: readonly GridCell[]): number {
  return cells.reduce((sum, cell) => sum + cell.entryCount, 0)
}

/**
 * One cell, holding the provider's figure for that day rather than only the
 * part of it that arrived.
 *
 * Nothing on the cell records how much was added. What the screen does with
 * that difference is report it per row, from `placed`, and only for the part
 * no column could account for — so a per-cell copy would be a field with no
 * reader, and a field with no reader is how a model starts lying.
 *
 * `share` has to be recomputed rather than carried: it is the bar, and a bar
 * still drawn against the visible hours under a figure that grew would be the
 * one mark on the screen disagreeing with the number beside it.
 */
function placedCell(cell: GridCell, declared: DeclaredTotals | undefined): GridCell {
  if (!declared) {
    return cell
  }

  const hours = secondsToHours(declared.seconds)

  return {
    ...cell,
    entryCount: declared.entryCount,
    hours,
    // A day the provider counted entries on is a day that was worked, whatever
    // it looked like before they were added.
    kind: declared.entryCount > 0 ? 'logged' : cell.kind,
    seconds: declared.seconds,
    share: cell.referenceHours === 0 ? null : hours / cell.referenceHours,
  }
}

function placedRow(row: GridRow, declaration: undefined | WithheldDeclaration): GridRow {
  // Nothing is placed on a row the provider would not resolve. Its cells say
  // nothing is known, and an hour folded into one of them would be this app
  // vouching for a figure it cannot attribute to anybody.
  if (row.identity.kind !== 'confirmed' || !declaration || !tiles(row, declaration)) {
    return row
  }

  const cells = row.cells.map((cell) => placedCell(cell, declaration.byColumn.get(cell.key)))

  return {
    ...row,
    cells,
    // Measured against the cells as they were, before the difference was added
    // into them — afterwards there is no difference left to measure.
    placed: placedTotal(row.cells, declaration),
    total: totalOf(cells),
  }
}

/**
 * How much of the row's shortfall now has a column of its own.
 *
 * Not the same as the shortfall itself: that is measured over the widened
 * window the pages were read from, and these columns only cover the period. An
 * entry withheld on a padding day is in the one and not in the other, which is
 * exactly why the interface reports the remainder separately rather than
 * assuming the placement accounted for everything.
 */
function placedTotal(cells: readonly GridCell[], declaration: WithheldDeclaration): Shortfall {
  let entryCount = 0
  let seconds = 0

  for (const cell of cells) {
    const declared = declaration.byColumn.get(cell.key)

    if (declared) {
      entryCount += declared.entryCount - cell.entryCount
      seconds += declared.seconds - cell.seconds
    }
  }

  return { entryCount, hours: secondsToHours(seconds), seconds }
}

/**
 * Whether the column spans really covered the period, once each.
 *
 * Three checks, and each one catches a different way of being wrong:
 *
 * - The columns' own entries add up to the period's. If the provider rounded
 *   the spans out to whole UTC days they would overlap, and the sum would come
 *   in high; if a span were built a millisecond short of the next the sum would
 *   come in low. Either way this is the instrument that sees it, and it is free.
 * - No column declares fewer entries than the reader was shown in it. A column
 *   the probe never asked about answers nothing and fails here rather than
 *   silently reading as "nothing withheld".
 * - The period declares at least what the row draws. This also closes the hole
 *   where the provider will not resolve the person at all: the probe answers a
 *   count of zero,
 *   which is otherwise indistinguishable from a clean month.
 */
function tiles(row: GridRow, declaration: WithheldDeclaration): boolean {
  if (declaredOver(declaration) !== declaration.period.entryCount) {
    return false
  }

  if (declaration.period.entryCount < drawnOver(row.cells)) {
    return false
  }

  return row.cells.every(
    (cell) => (declaration.byColumn.get(cell.key)?.entryCount ?? 0) >= cell.entryCount,
  )
}
