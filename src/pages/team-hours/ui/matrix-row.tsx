import { memo } from 'react'

import type { GridRow, Shortfall } from '@/entities/team-timelogs'

import { unplacedOf } from '@/entities/team-timelogs'
import { m, useActiveLocale } from '@/shared/i18n'
import { formatHours } from '@/shared/lib/format'
import { HourFigure } from '@/shared/ui/hour-figure'

import type { ColumnMarks } from '../lib/marks'

import { DayCell } from './day-cell'
import { PersonCell } from './person-cell'

const STICKY_LEFT =
  'sticky left-0 z-10 w-56 min-w-56 max-w-56 border-r border-b border-border bg-card px-3 text-left align-middle group-hover:bg-accent'

const STICKY_RIGHT =
  'relative sticky right-0 z-10 w-24 min-w-24 border-b border-l border-border bg-card px-3 text-right align-middle group-hover:bg-accent'

interface MatrixRowProps {
  /** True once the whole period has been read, so a total is an answer. */
  readonly complete: boolean
  readonly marks: ColumnMarks
  readonly row: GridRow
  /** True when the figures are narrowed to a group. See `DayCell`. */
  readonly scoped: boolean
}

/**
 * One person's month.
 *
 * Memoised: a month of a forty-person team is over a thousand cells, and
 * re-ordering the rows or hovering one would otherwise re-render every one of
 * them. While the month is still being read every cell is reserved space rather
 * than a figure, so the renders that happen most are also the cheapest, and the
 * one full render happens once.
 *
 * Deliberately **not** carrying `.cv-auto`, which the day feed uses. That
 * utility sets `content-visibility: auto` with no intrinsic size, which is right
 * for a block that can collapse and re-expand on its own — and wrong for a table
 * row, where an off-screen row collapsing to nothing takes the column widths and
 * the scroll height with it.
 */
export const MatrixRow = memo(function MatrixRow({ complete, marks, row, scoped }: MatrixRowProps) {
  const { locale } = useActiveLocale()
  const { allHidden, caveat, known, withheld } = readingOf(row, complete, locale)

  return (
    <tr className="group">
      <th className={STICKY_LEFT} scope="row">
        <PersonCell hidden={allHidden} row={row} />
      </th>
      {row.cells.map((cell, index) => (
        <DayCell
          cell={cell}
          key={cell.key}
          last={index === row.cells.length - 1}
          marks={marks}
          scoped={scoped}
          unreadable={withheld}
        />
      ))}
      <td className={STICKY_RIGHT}>
        {complete && known ? (
          <span className="tabular text-sm font-semibold">
            <HourFigure
              className=""
              hours={row.total.hours}
              unitClassName="ml-0.5 text-xs font-normal text-muted-foreground"
            />
          </span>
        ) : null}
        {known && !complete ? (
          <span
            aria-hidden
            className="ml-auto block h-3 w-10 animate-pulse rounded-sm bg-chart-empty"
          />
        ) : null}
        {/* Drawn as nothing at all rather than as reserved space: reserved space
            is a figure that is coming, and for this row none ever will. */}
        {known ? null : <span className="sr-only">{m.team_row_total_unknown()}</span>}
        {caveat === null || !complete ? null : (
          <span className="block text-[11px] leading-tight text-muted-foreground">{caveat}</span>
        )}
      </td>
    </tr>
  )
})

/** How much this row is allowed to claim, and what it has to add. */
interface Reading {
  /** The provider counted hours for them and showed none of them. */
  readonly allHidden: boolean
  /** What could not be accounted for, in words, or null when nothing is. */
  readonly caveat: null | string
  /**
   * The provider resolved them.
   *
   * Nothing is claimed about a month nobody answered about. Every cell of such a
   * row already says so; the total is the one place the rule could still be
   * broken, and a "0 h" beside a line saying the provider did not recognise them
   * is precisely the reading GROUP-21 forbids — an absent answer is not an
   * answer of zero.
   */
  readonly known: boolean
  /** Entries the provider counted for this person and did not hand over. */
  readonly withheld: boolean
}

/**
 * What this row could not account for, in whichever direction it falls.
 *
 * Both directions, because they are different facts and only one of them can be
 * recovered by reading further. Hours missing are hours the provider counted and
 * would not show. Hours in surplus mean the figures here are too HIGH — which
 * happens when a correcting entry is one of the ones withheld, and is the
 * direction no amount of further reading can uncover. Reporting it as nothing
 * missing would turn "these figures overstate somebody's month" into silence.
 *
 * It belongs on the row rather than in the status region: that region answers
 * when the hours arrived, whether they are arriving now, and whether asking
 * failed — three questions, none of them about a figure — and a caveat announced
 * on every refresh, nowhere near the number it qualifies, is a caveat nobody
 * connects to anything.
 *
 * Null when there is nothing to say, so a settled row carries no empty notice.
 */
function caveatFor(shortfall: null | Shortfall, locale: string): null | string {
  if (shortfall === null || shortfall.seconds === 0) {
    return null
  }

  return shortfall.seconds > 0
    ? m.team_row_hidden({ hours: formatHours(shortfall.hours, locale) })
    : m.team_row_overstated({ hours: formatHours(-shortfall.hours, locale) })
}

/**
 * The four facts the row draws itself from, read once.
 *
 * Together rather than one at a time in the component body: each is a fact about
 * how much this row may claim, they are read in that order, and four of them
 * inline put the component over the complexity ceiling — which is the ceiling
 * doing its job, because a component computing what it is entitled to say is a
 * component doing two things.
 */
function readingOf(row: GridRow, complete: boolean, locale: string): Reading {
  // What is left of the shortfall after the cells took their share of it. On a
  // row whose hours were all placed this is nothing, and the note disappears —
  // the marks in the columns say the same thing, and say where.
  const unplaced = unplacedOf(row)
  // The count rather than the seconds: a withheld entry and a withheld
  // correction cancel in seconds while both are still being kept from the reader.
  const withheld = complete && unplaced !== null && unplaced.entryCount !== 0

  return {
    // Read here so the cell takes a plain boolean: a `&&` chain in a prop
    // renders its own falsy value, which is what `jsx-no-leaked-render` is about.
    allHidden: withheld && row.total.entryCount === 0,
    caveat: caveatFor(unplaced, locale),
    known: row.identity.kind === 'confirmed',
    withheld,
  }
}
