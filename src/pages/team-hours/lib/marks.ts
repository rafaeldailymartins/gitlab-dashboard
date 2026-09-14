import type { GridColumn } from '@/entities/group-timelogs'

import { type IsoDate, isoWeekOf } from '@/shared/lib/date'

/**
 * The two things a cell needs to know about its column that its own value
 * cannot tell it.
 *
 * Computed once for the whole table rather than per cell: a month of a
 * forty-person team asks the question forty times per column, and both answers
 * are the same for every row.
 */
export interface ColumnMarks {
  /** The column the reader's today falls in, or `''` for any other period. */
  readonly today: string
  /** The columns that close an ISO week, which is where the weeks divide. */
  readonly weekEnds: ReadonlySet<string>
}

/**
 * The vertical rule a column carries on its right.
 *
 * Weeks are divided by a full-strength rule and the days inside one by a faint
 * rule, so a month reads as five blocks rather than as thirty-one stripes.
 * Today's column is bounded on both sides instead: the filled chip in the header
 * says which day it is, and this is what lets the eye follow it down a long
 * table. The header, the body and the totals all ask here, so a column cannot be
 * divided one way in one row and another way in the next.
 */
export function dividerFor(key: string, marks: ColumnMarks, last: boolean): string {
  if (key === marks.today) {
    return 'border-x border-primary'
  }

  if (last) {
    return ''
  }

  return marks.weekEnds.has(key) ? 'border-r border-border' : 'border-r border-border/50'
}

export function marksOf(columns: readonly GridColumn[], today: IsoDate): ColumnMarks {
  return {
    today: columns.find((column) => today >= column.from && today <= column.to)?.key ?? '',
    weekEnds: new Set(
      columns
        .filter((column, index) => closesWeek(column, columns[index + 1]))
        .map((column) => column.key),
    ),
  }
}

/**
 * Whether the next column belongs to a different week.
 *
 * The last column of the period closes nothing: it already has the table's own
 * edge, and a rule drawn against it would sit beside the border of the total
 * column.
 */
function closesWeek(column: GridColumn, next: GridColumn | undefined): boolean {
  return next !== undefined && isoWeekOf(next.from) !== isoWeekOf(column.from)
}
