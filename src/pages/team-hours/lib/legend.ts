import type { TeamGrid } from '@/entities/team-timelogs'

/** Which marks this particular report actually uses. */
export interface LegendShows {
  readonly nonWorking: boolean
  readonly over: boolean
  readonly unlogged: boolean
}

/**
 * What the legend has to explain, read off the table rather than assumed.
 *
 * A key for a mark that is nowhere on screen is worse than no key at all: the
 * reader scans the table for it, does not find it, and is left wondering what
 * they missed.
 *
 * The reference bar is not here because it explains every figure in the table,
 * so a table with any row at all needs it.
 */
export function legendShows(grid: TeamGrid): LegendShows {
  const cells = grid.rows.flatMap((row) => row.cells)

  return {
    nonWorking: cells.some((cell) => cell.share === null),
    over: cells.some((cell) => (cell.share ?? 0) > 1),
    unlogged: cells.some((cell) => cell.kind === 'unlogged'),
  }
}
