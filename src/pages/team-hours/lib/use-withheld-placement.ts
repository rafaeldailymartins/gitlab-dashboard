import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'

import type { GridRow, TeamReport, WithheldDeclaration } from '@/entities/team-timelogs'

import {
  spanColumns,
  teamColumnsQuery,
  useTeamTimelogGateway,
  withWithheld,
} from '@/entities/team-timelogs'

/**
 * How many people one report will ask about, at one request each.
 *
 * The requests are issued together, so the cost is one round trip rather than
 * six — but each is a month of aggregates on the provider's database, and a team
 * where everybody is short is a team whose work the reader can mostly not open,
 * where the marks would tell them little the notice does not. Rows past the cap
 * keep the note that says hours are missing without saying where.
 */
const PLACEMENT_LIMIT = 6

interface PlacementInput {
  /**
   * The group the figures are narrowed to, or null.
   *
   * It decides whether the placement runs at all, not only what it asks about.
   * See `rowsToAsk`.
   */
  readonly groupId: null | string
  readonly report: TeamReport
  readonly timeZone: string
}

/**
 * The report again, with each person's withheld hours against the column they
 * were logged in.
 *
 * Costs nothing in the ordinary case, and that is the design. The first round
 * already carried a `count` as well as a total, so a row whose count matches
 * what arrived proves — free, with no second request — that nothing was removed
 * from it. Only rows that fail that test are asked about, and where the reader
 * can open everything there are none.
 *
 * The placement is checked before it is drawn (`model/withheld.ts`), and it
 * never moves an hour already on screen: those come from the entries the rounds
 * carried, bucketed in the reader's own zone, exactly as before. A probe that
 * cannot be trusted costs its marks and nothing else.
 */
export function useWithheldPlacement({ groupId, report, timeZone }: PlacementInput): TeamReport {
  const gateway = useTeamTimelogGateway()
  const columns = useMemo(
    () => spanColumns(report.grid.columns, timeZone),
    [report.grid.columns, timeZone],
  )
  const asking = useMemo(() => rowsToAsk(report, groupId), [report, groupId])
  const declarations = useQueries({
    // Combined here rather than in a memo below: `useQueries` returns a fresh
    // array every render, and a report rebuilt on every render would defeat the
    // memo on every row of the matrix.
    combine: (answers) => declarationsOf(asking, answers),
    queries: asking.map((row) => teamColumnsQuery(gateway, requestFor(groupId, columns, row))),
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
      declarations.set(row.member.id, answer)
    }
  }

  return declarations
}

function requestFor(
  groupId: null | string,
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
    // The same narrowing the figures were read under, or none. An instrument
    // measuring a different set than the figures makes every shortfall on the
    // screen nonsense, and does it silently.
    groupId,
    memberId: row.member.id,
    to: columns.at(-1)?.to ?? '',
  }
}

/**
 * Who is worth asking about, in a stable order.
 *
 * Nobody until the whole team has been read: before then a difference between
 * what the provider counted and what arrived is simply the part not read yet.
 *
 * **And nobody at all on an unnarrowed report.** The cap was chosen when this
 * screen read one group, where a short row was unusual — a Guest, mostly — and
 * six requests located an anomaly. Reading a team's whole reach inverts that: a
 * reader sees every colleague's working life through their own permissions, so
 * almost every row is short, and six of twenty getting day-level marks while the
 * rest keep the note is a difference on screen that corresponds to nothing about
 * the data. Which six is decided by an identifier the reader never sees.
 *
 * Raising the cap is not the answer either. A month of columns is 7 points of
 * GitLab's 250-point complexity budget each, so a grid cannot be asked for at
 * all; the cost is one request per row and it is the provider's database that
 * pays. Twenty of them on every report, to locate a shortfall that is the
 * ordinary condition rather than a surprise, is a bad trade at any cap.
 *
 * Narrowed, being short means something again: the reader chose a group they can
 * mostly open, so a row short *in it* is worth locating. Unnarrowed the row
 * still says hours are missing — it just does not say where, which is exactly
 * what it says when a placement is refused, so the screen grows no new state.
 *
 * Ordered by the identifier rather than by how much is missing. Ordering by
 * size would let two rows a few minutes apart swap places between two loads of
 * the same month, so which rows got marks and which kept the note would change
 * under a reader who changed nothing.
 */
function rowsToAsk(report: TeamReport, groupId: null | string): readonly GridRow[] {
  if (!report.complete || groupId === null) {
    return []
  }

  return report.grid.rows
    .filter((row) => row.shortfall !== null && row.shortfall.entryCount !== 0)
    .toSorted((left, right) => left.member.id.localeCompare(right.member.id, 'en'))
    .slice(0, PLACEMENT_LIMIT)
}
