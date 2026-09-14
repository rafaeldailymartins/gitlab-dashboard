import { memo } from 'react'

import type { GridRow, Shortfall } from '@/entities/group-timelogs'

import { unplacedOf } from '@/entities/group-timelogs'
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
export const MatrixRow = memo(function MatrixRow({ complete, marks, row }: MatrixRowProps) {
  const { locale } = useActiveLocale()
  // What is left of the shortfall after the cells took their share of it. On a
  // row whose hours were all placed this is nothing, and the note disappears —
  // the marks in the columns say the same thing, and say where.
  const unplaced = unplacedOf(row)
  const hidden = hiddenHoursOf(unplaced)
  // Entries the provider counted for this person and did not hand over. The
  // count rather than the seconds: a withheld entry and a withheld correction
  // cancel in seconds while both are still being kept from the reader.
  const withheld = complete && unplaced !== null && unplaced.entryCount !== 0
  // Hours the provider counted for somebody and showed none of. Read here so
  // the cell takes a plain boolean: a `&&` chain in a prop renders its own
  // falsy value, which is what `jsx-no-leaked-render` is about.
  const allHidden = withheld && row.total.entryCount === 0

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
          unreadable={withheld}
        />
      ))}
      <td className={STICKY_RIGHT}>
        {complete ? (
          <span className="tabular text-sm font-semibold">
            <HourFigure
              className=""
              hours={row.total.hours}
              unitClassName="ml-0.5 text-xs font-normal text-muted-foreground"
            />
          </span>
        ) : (
          <span
            aria-hidden
            className="ml-auto block h-3 w-10 animate-pulse rounded-sm bg-chart-empty"
          />
        )}
        {hidden === null || !complete ? null : (
          <span className="block text-[11px] leading-tight text-muted-foreground">
            {m.team_row_hidden({ hours: formatHours(hidden, locale) })}
          </span>
        )}
      </td>
    </tr>
  )
})

/**
 * The hours the provider counted for somebody and did not show.
 *
 * Null when there is nothing to say — including when the difference runs the
 * other way, which is a statement about the whole report rather than about one
 * person, and is made once, in the status region.
 */
function hiddenHoursOf(shortfall: null | Shortfall): null | number {
  return shortfall !== null && shortfall.seconds > 0 ? shortfall.hours : null
}
