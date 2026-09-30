import { useMemo, useState } from 'react'

import type { Granularity, GridColumn, GroupRef, TeamReport } from '@/entities/team-timelogs'
import type { IsoDate } from '@/shared/lib/date'

import { m, useActiveLocale } from '@/shared/i18n'
import { formatMonth } from '@/shared/lib/format'

import { marksOf } from '../lib/marks'
import { DEFAULT_ORDER, nextOrder, ordered, type RowOrder } from '../lib/order'
import { DayHeaderRow } from './day-header-row'
import { MatrixFoot } from './matrix-foot'
import { MatrixRow } from './matrix-row'
import { WeekBandRow } from './week-band-row'

/**
 * The container owns **both** axes.
 *
 * `overflow-x: auto` makes an element a scroll container on both axes anyway, so
 * a header sticking to the viewport inside one would not stick at all. Owning
 * both deliberately is what lets the headers and the two edge columns stay put.
 *
 * `tabindex` is required by axe's `scrollable-region-focusable`, and a region
 * that takes focus must draw one — the keyboard walk reads the computed style at
 * every stop.
 */
const SCROLL =
  'max-h-[calc(100svh-15rem)] overflow-auto rounded-xl border border-border bg-card focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'

/**
 * `border-separate` rather than the default: a collapsed border belongs to the
 * table rather than to the cell, so it scrolls away and leaves every sticky cell
 * edgeless. `table-fixed` with a `<colgroup>` also keeps the columns from
 * re-measuring as figures arrive, which would shift the whole grid under the
 * reader.
 */
const TABLE = 'w-max min-w-full table-fixed border-separate border-spacing-0 text-sm'

interface TeamMatrixProps {
  readonly granularity: Granularity
  readonly month: IsoDate
  readonly report: TeamReport
  /** The group the figures were narrowed to, or null for the reader's whole reach. */
  readonly scope: 'unreadable' | GroupRef | null
  readonly teamName: string
  readonly today: IsoDate
}

/**
 * People down, columns across.
 *
 * This scroll container is the screen's **only** named region: a named
 * `<section>` is also a `region` landmark, and two of them sharing a name fails
 * axe's `landmark-unique`, which this suite runs.
 */
export function TeamMatrix({
  granularity,
  month,
  report,
  scope,
  teamName,
  today,
}: TeamMatrixProps) {
  const { locale } = useActiveLocale()
  const [order, setOrder] = useState<RowOrder>(DEFAULT_ORDER)
  const { columns, columnTotals, grandTotal, rows, weeks } = report.grid
  const visible = useMemo(() => ordered(rows, order), [rows, order])
  const marks = useMemo(() => marksOf(columns, today), [columns, today])
  // A group that resolved is the only narrowing there is: no filter and a
  // filter this reader cannot open both leave the figures at their whole reach.
  const scoped = scope !== null && scope !== 'unreadable'

  return (
    // A scrollable region with no focusable content has to be focusable itself,
    // or a keyboard reader cannot scroll it — axe's `scrollable-region-focusable`
    // is WCAG 2.1.1 and this suite runs it. `jsx-a11y` does not know the element
    // scrolls, so its rule and that one disagree; the one measuring the real page
    // wins.
    // Both linters flag the `tabIndex` and neither knows the element scrolls.
    // ESLint's rule is configured to accept `region` — see the reason beside it
    // in `eslint.config.js`; Biome's has no such option, so it is suppressed
    // here for the same reason.
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable (WCAG 2.1.1); axe's scrollable-region-focusable fails without it.
    <div aria-label={m.team_title()} className={SCROLL} role="region" tabIndex={0}>
      <table className={TABLE}>
        {/* The caption carries the scope, so it is announced where the figures
            are: a reader who reaches this table by landmark never passes the
            sentence under the heading. Two captions rather than one with a
            blank in it — an unnarrowed report makes a stronger claim than a
            narrowed one, and the two must not be phrased as though they were
            the same claim with a word missing. */}
        <caption className="sr-only">
          {captionOf(scope, teamName, formatMonth(month, locale))}
        </caption>
        <ColumnWidths columns={columns} granularity={granularity} />
        <thead>
          <WeekBandRow
            bands={weeks}
            columnCount={columns.length}
            onOrder={(by) => {
              setOrder(nextOrder(order, by))
            }}
            order={order}
          />
          <DayHeaderRow columns={columns} granularity={granularity} marks={marks} today={today} />
        </thead>
        <tbody>
          {visible.map((row) => (
            <MatrixRow
              complete={report.complete}
              key={row.member.id}
              marks={marks}
              row={row}
              scoped={scoped}
            />
          ))}
        </tbody>
        <MatrixFoot
          columns={columns}
          columnTotals={columnTotals}
          complete={report.complete}
          grandTotal={grandTotal}
          marks={marks}
        />
      </table>
    </div>
  )
}

/** What the table is about, and how far the figures in it reach. */
function captionOf(scope: 'unreadable' | GroupRef | null, team: string, month: string): string {
  if (scope === null || scope === 'unreadable') {
    return m.team_table_caption_everywhere({ month, team })
  }

  return m.team_table_caption_group({ group: scope.name, month, team })
}

/**
 * Every column's width, stated once.
 *
 * A fixed table takes its widths from the first row, and the first row here is
 * the week bands — cells that span several columns and so say nothing about any
 * one of them. A `<colgroup>` is where a fixed layout is meant to be told, and
 * it is also what lets a column nothing is expected of be narrower than a working
 * one: under a five-day week, two thin columns every seven is what makes a month read as five weeks rather than as thirty-one
 * stripes.
 */
function ColumnWidths({
  columns,
  granularity,
}: {
  readonly columns: readonly GridColumn[]
  readonly granularity: Granularity
}) {
  return (
    <colgroup>
      <col className="w-56" />
      {columns.map((column) => (
        <col className={widthOf(column, granularity)} key={column.key} />
      ))}
      <col className="w-24" />
    </colgroup>
  )
}

function widthOf(column: GridColumn, granularity: Granularity): string {
  if (granularity === 'weeks') {
    return 'w-24'
  }

  // Narrower than a working day, and wide enough for the weekday's own name:
  // the abbreviation is why this is not 'w-8' any more.
  return column.referenceHours === 0 ? 'w-11' : 'w-12'
}
