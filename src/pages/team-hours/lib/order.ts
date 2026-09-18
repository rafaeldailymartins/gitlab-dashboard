import type { GridRow } from '@/entities/team-timelogs'

import { rowName } from './naming'

/** Which column the rows are ordered by, and which way. */
export interface RowOrder {
  readonly by: 'person' | 'total'
  readonly descending: boolean
}

export const DEFAULT_ORDER: RowOrder = { by: 'person', descending: false }

/** Turning the same heading again reverses it; a different one starts afresh. */
export function nextOrder(order: RowOrder, by: RowOrder['by']): RowOrder {
  if (order.by === by) {
    return { by, descending: !order.descending }
  }

  // Totals open descending: the question a reader brings to that column is who
  // logged most, and a click that answered the opposite would need a second one.
  return { by, descending: by === 'total' }
}

/**
 * Only two columns order the rows, and neither is a day.
 *
 * Every orderable heading is a place the keyboard stops. A month of orderable
 * day columns would put thirty-one stops between the controls and the report
 * itself, over a heading two and a half characters wide — and "who logged
 * least" is answered by the total, not by the twelfth.
 *
 * Ordered here rather than through a table library: the columns of this table
 * are a period, not a fixed set of fields, so the rows are the only thing with a
 * comparator and a comparator is all this needs.
 */
export function ordered(rows: readonly GridRow[], order: RowOrder): readonly GridRow[] {
  const sorted = rows.toSorted(order.by === 'total' ? byTotal : byName)

  return order.descending ? sorted.toReversed() : sorted
}

function byName(left: GridRow, right: GridRow): number {
  return rowName(left).localeCompare(rowName(right))
}

function byTotal(left: GridRow, right: GridRow): number {
  return left.total.seconds - right.total.seconds
}
