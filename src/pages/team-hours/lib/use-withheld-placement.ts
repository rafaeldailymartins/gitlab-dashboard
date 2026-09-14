import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'

import type { GridRow, GroupReport, WithheldDeclaration } from '@/entities/group-timelogs'

import {
  groupColumnsQuery,
  spanColumns,
  useGroupTimelogGateway,
  withWithheld,
} from '@/entities/group-timelogs'

/**
 * How many people one report will ask about, at one request each.
 *
 * The requests are issued together, so the cost is one round trip rather than
 * six — but each is a month of aggregates on the provider's database, and a
 * group where everybody is short is a group where the reader can read almost
 * nothing and the marks would tell them little the notice does not. Rows past
 * the cap keep the note that says hours are missing without saying where.
 */
const PLACEMENT_LIMIT = 6

interface PlacementInput {
  readonly fullPath: string
  readonly report: GroupReport
  readonly timeZone: string
}

/**
 * The report again, with each person's withheld hours against the column they
 * were logged in.
 *
 * Costs nothing in the ordinary case, and that is the design. The per-person
 * probe the report already ran reports a `count` as well as a total, so a row
 * whose count matches what arrived proves — free, with no second request — that
 * nothing was removed from it. Only rows that fail that test are asked about,
 * and on a group the reader can read fully there are none.
 *
 * The placement is checked before it is drawn (`model/withheld.ts`), and it
 * never moves an hour already on screen: those come from the entries the pages
 * carried, bucketed in the reader's own zone, exactly as before. A probe that
 * cannot be trusted costs its marks and nothing else.
 */
export function useWithheldPlacement({ fullPath, report, timeZone }: PlacementInput): GroupReport {
  const gateway = useGroupTimelogGateway()
  const columns = useMemo(
    () => spanColumns(report.grid.columns, timeZone),
    [report.grid.columns, timeZone],
  )
  const asking = useMemo(() => rowsToAsk(report), [report])
  const declarations = useQueries({
    // Combined here rather than in a memo below: `useQueries` returns a fresh
    // array every render, and a report rebuilt on every render would defeat the
    // memo on every row of the matrix.
    combine: (answers) => declarationsOf(asking, answers),
    queries: asking.map((row) => groupColumnsQuery(gateway, requestFor(fullPath, columns, row))),
  })

  return useMemo(
    () => ({ ...report, grid: withWithheld(report.grid, declarations) }),
    [report, declarations],
  )
}

function declarationsOf(
  rows: readonly GridRow[],
  answers: readonly { data?: undefined | WithheldDeclaration }[],
): ReadonlyMap<string, WithheldDeclaration> {
  const declarations = new Map<string, WithheldDeclaration>()

  for (const [index, row] of rows.entries()) {
    const answer = answers[index]?.data

    if (answer) {
      declarations.set(row.person.username, answer)
    }
  }

  return declarations
}

function requestFor(
  fullPath: string,
  columns: readonly { from: string; key: string; to: string }[],
  row: GridRow,
) {
  return {
    columns,
    // The period runs from the first column's opening instant to the last
    // one's closing instant, so the check that the spans tile it is a check
    // against exactly the days on screen and not against a month boundary
    // computed a second, different way.
    from: columns[0]?.from ?? '',
    fullPath,
    to: columns.at(-1)?.to ?? '',
    username: row.person.username,
  }
}

/**
 * Who is worth asking about, in a stable order.
 *
 * Nobody until the period has been read: before then a difference between what
 * the provider counted and what arrived is simply the part not read yet.
 *
 * Ordered by username rather than by how much is missing. Ordering by size
 * would let two rows a few minutes apart swap places between two loads of the
 * same month, so which rows got marks and which kept the note would change
 * under a reader who changed nothing.
 */
function rowsToAsk(report: GroupReport): readonly GridRow[] {
  if (!report.complete) {
    return []
  }

  return report.grid.rows
    .filter((row) => row.shortfall !== null && row.shortfall.entryCount !== 0)
    .toSorted((left, right) => left.person.username.localeCompare(right.person.username, 'en'))
    .slice(0, PLACEMENT_LIMIT)
}
