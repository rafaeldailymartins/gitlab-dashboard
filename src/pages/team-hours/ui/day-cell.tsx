import type { ReactNode } from 'react'

import type { CellKind, GridCell } from '@/entities/team-timelogs'

import { m } from '@/shared/i18n'
import { HourFigure } from '@/shared/ui/hour-figure'

import type { ColumnMarks } from '../lib/marks'

import { dividerFor } from '../lib/marks'

/**
 * How wide the bar is at exactly the reference, and how far past it a bar may
 * be drawn.
 *
 * The reference mark sits between the two, so a day above the reference is a bar
 * that visibly crosses a line. That is a difference in shape: it survives
 * greyscale, forced colours, and every colour-vision deficiency — which a second
 * hue would not, and `charts.css` already records the pair that proves it.
 */
const REFERENCE_WIDTH = 28
const BEYOND_WIDTH = 10

const PERCENT = 100

const CELL = 'relative h-12 border-b border-border p-0 text-center align-middle'

/** A column nothing is expected of keeps its tint under a row hover. */
const TINTED = 'bg-chart-empty'

interface DayCellProps {
  readonly cell: GridCell
  /** True for the last column of the whole period, which needs no divider. */
  readonly last: boolean
  readonly marks: ColumnMarks
  /**
   * True when the figures are narrowed to a group, which weakens what an empty
   * day may claim.
   *
   * Unnarrowed, an empty day means this person logged nothing the provider will
   * show this reader, anywhere — the strongest claim this screen has ever been
   * able to make. Narrowed, it means only that there is nothing in that group,
   * and the cell must say **that** and no more: an hour logged in a sibling
   * group is not missing from the answer, it was never asked for.
   */
  readonly scoped: boolean
  /**
   * True when the provider counted entries for this person in this window and
   * handed none of them over for this cell's row.
   *
   * An empty working day then means one thing the screen can rule out: the
   * reader is being shown less than the provider counted, so even "nothing
   * here" is known to be understated.
   */
  readonly unreadable: boolean
}

/** The kinds the model reports, plus the three this file resolves itself. */
type DrawnKind = 'unlogged-anywhere' | 'unreadable' | 'unreadable-anywhere' | CellKind

/**
 * One person on one column.
 *
 * The cell says nothing about who or when: the row header and the column header
 * already do, and assistive technology reads both on every move. Repeating them
 * here would make a row of thirty-one cells announce the person thirty-one
 * times.
 *
 * Every cell is positioned. The hour figures and the state sentences are
 * `sr-only`, which is `position: absolute` — and an absolutely positioned box
 * inside an unpositioned cell is laid out against the document, not against the
 * table. It then escapes the scroll container entirely and stretches the *page*
 * to the width of the month, which is the one thing UI-11 forbids. Positioning
 * the cell puts the containing block back inside the scroller.
 */
export function DayCell({ cell, last, marks, scoped, unreadable }: DayCellProps) {
  return (
    <td
      className={`${CELL} ${expectsNothing(cell) ? TINTED : ''} ${dividerFor(cell.key, marks, last)}`}
    >
      {BODY[drawn(cell, scoped, unreadable)](cell)}
    </td>
  )
}

/**
 * Which of the cases the cell is drawn as.
 *
 * Three of them are not kinds the model knows about, and all three are about
 * what an empty working day may be said to mean. The reach decides how strong
 * the claim may be; whether the row was shown everything the provider counted
 * decides whether it may be made at all. Both facts are the interface's, and
 * they compose — which is why there are four sentences rather than two, and why
 * getting it wrong in one corner was possible.
 *
 * Withheld hours are not a case here. They are added into the figure by
 * `model/withheld.ts`, so a cell that holds them is simply a cell that holds
 * hours — which is the point of adding them.
 */
function drawn(cell: GridCell, scoped: boolean, unreadable: boolean): DrawnKind {
  if (cell.kind !== 'unlogged') {
    return cell.kind
  }

  if (unreadable) {
    return scoped ? 'unreadable' : 'unreadable-anywhere'
  }

  return scoped ? 'unlogged' : 'unlogged-anywhere'
}

/**
 * What each kind of cell draws, as a lookup rather than a chain of conditions.
 *
 * Nine cases is far more than a readable ternary chain, and `sonarjs` forbids
 * nesting them; a `switch` over nine would sit on the complexity ceiling. A
 * table stays flat and takes a tenth without touching any of the nine.
 */
const BODY: Record<DrawnKind, (cell: GridCell) => ReactNode> = {
  future: () => null,
  logged: (cell) => <Logged cell={cell} />,
  'non-working': () => null,
  // Nothing is reserved where nothing is expected. The placeholder stands in for
  // a figure that is coming; a weekend is not owed one, and two columns of
  // pulsing chips down every row read as activity rather than as absence. The
  // cell keeps its height either way, so an entry logged on a Saturday still
  // arrives without moving anything.
  pending: (cell) => (expectsNothing(cell) ? null : <Pending />),
  // Nothing at all is known about this person: the provider would not resolve
  // the identifier the team stores. A figure here would be invented, and a dash
  // would read as a day they did not work.
  unknown: () => <Unknown />,
  unlogged: () => <Unlogged spoken={m.team_cell_unlogged_in_group()} />,
  'unlogged-anywhere': () => <Unlogged spoken={m.team_cell_unlogged_anywhere()} />,
  unreadable: () => <Unlogged spoken={m.team_cell_unreadable_in_group()} />,
  'unreadable-anywhere': () => <Unlogged spoken={m.team_cell_unreadable_anywhere()} />,
}

/**
 * The magnitude, against the reference the legend states.
 *
 * Nothing is drawn where nothing is expected: a bar needs a whole to be a
 * fraction of, and a weekend has none.
 */
function Bar({ share }: { readonly share: null | number }) {
  if (share === null) {
    return null
  }

  const within = Math.min(Math.max(share, 0), 1)
  const beyond = Math.min(Math.max(share - 1, 0), 1)

  return (
    <span aria-hidden className="flex h-1 items-stretch">
      <span
        className="rounded-l-sm bg-chart-empty"
        style={{ width: `${String(REFERENCE_WIDTH)}px` }}
      >
        <span
          className="block h-full rounded-l-sm bg-chart-bar"
          style={{ width: `${String(within * PERCENT)}%` }}
        />
      </span>
      <span className="relative" style={{ width: `${String(BEYOND_WIDTH)}px` }}>
        <span className="absolute -top-0.5 -bottom-0.5 left-0 border-l border-dashed border-chart-target" />
        <span
          className="block h-full rounded-r-sm bg-chart-bar"
          style={{ width: `${String(beyond * PERCENT)}%` }}
        />
      </span>
    </span>
  )
}

/**
 * Whether the reference expects anything of this column.
 *
 * Read from `share` rather than from the kind: a cell is only `non-working` once
 * its column has been read and nobody logged in it, so a weekend still being
 * read — or one later this month — would otherwise lose the tint that makes the
 * weeks legible, and the table would change shape as the pages landed.
 */
function expectsNothing(cell: GridCell): boolean {
  return cell.share === null
}

function Logged({ cell }: { readonly cell: GridCell }) {
  return (
    <span className="flex flex-col items-center justify-center gap-1">
      <span className="tabular text-[13px] leading-none font-medium">
        <HourFigure className="" hours={cell.hours} unitClassName="hidden" />
      </span>
      <Bar share={cell.share} />
    </span>
  )
}

/** A column not read yet. Space is reserved so arriving figures move nothing. */
function Pending() {
  return (
    <span className="flex items-center justify-center">
      <span aria-hidden className="block h-2.5 w-6 animate-pulse rounded-sm bg-chart-empty" />
      <span className="sr-only">{m.team_cell_pending()}</span>
    </span>
  )
}

/**
 * A day in a row about somebody the provider would not resolve.
 *
 * Drawn as nothing at all rather than as an absence: an absence is a claim, and
 * this row has no answer behind it to make one from.
 */
function Unknown() {
  return (
    <span className="flex items-center justify-center">
      <span aria-hidden className="inline-block size-1 rounded-full bg-muted-foreground/40" />
      <span className="sr-only">{m.team_cell_unknown()}</span>
    </span>
  )
}

/**
 * A day somebody was expected to log and did not.
 *
 * The glyph is hidden and the sentence is not: a dash read aloud is noise, and
 * the fact is worth hearing. Every case draws the same absence, because visually
 * it is the same absence — what differs is what may be claimed about it, and
 * that is spoken rather than drawn.
 */
function Unlogged({ spoken }: { readonly spoken: string }) {
  return (
    <span className="flex items-center justify-center">
      <span
        aria-hidden
        className="inline-block h-2 w-3.5 border-b border-dashed border-chart-target opacity-70"
      />
      <span className="sr-only">{spoken}</span>
    </span>
  )
}
