import type { GridRow, GroupReport } from '@/entities/group-timelogs'

/**
 * Who gets a row.
 *
 * The report still holds everybody, and every total on screen is computed before
 * this runs. What changes is only who is drawn — a row of thirty-one dashes is a
 * line of noise between two rows of figures, and on a screen read by scanning
 * across, noise is the expensive thing.
 *
 * Whoever is left out is left out silently. Naming them would read as "these
 * people logged nothing", and this screen cannot support that: it sees one
 * group, and an hour logged in a sibling group is invisible from here.
 *
 * Two rows survive having no figures. A person whose hours the provider counted
 * and would not show has something to say that a footnote cannot: their row
 * carries the shortfall, against the days it belongs to. And nobody is dropped
 * while the month is still being read — until then "logged nothing" is only
 * "not read yet", and dropping on it would take a real colleague off the screen
 * and put them back a second later.
 */
export function shownRows(report: GroupReport): readonly GridRow[] {
  if (!report.complete) {
    return report.grid.rows
  }

  return report.grid.rows.filter((row) => hasSomethingToShow(row))
}

/**
 * Whether a row has anything to say.
 *
 * Tested on the entry count, never on the seconds. A withheld entry and a
 * withheld correction net to zero seconds while still being two facts the
 * reader is not being shown, and a row dropped on a seconds test would take
 * them off the screen as though nothing had happened.
 */
function hasSomethingToShow(row: GridRow): boolean {
  return row.total.entryCount > 0 || (row.shortfall !== null && row.shortfall.entryCount !== 0)
}
