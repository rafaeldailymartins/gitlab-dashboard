import { ArrowDown, ArrowUp } from 'lucide-react'

import type { WeekBand } from '@/entities/team-timelogs'

import { m, useActiveLocale } from '@/shared/i18n'
import { formatShortDate } from '@/shared/lib/format'

import type { RowOrder } from '../lib/order'

const CORNER =
  'sticky left-0 top-0 z-30 w-56 min-w-56 max-w-56 border-r border-b border-border bg-card px-3 text-left'

const CORNER_RIGHT =
  'sticky right-0 top-0 z-30 w-24 min-w-24 border-b border-l border-border bg-card px-3 text-right'

const BAND =
  'sticky top-0 z-20 h-7 border-r border-b border-border bg-card px-2 text-[11px] font-medium text-muted-foreground'

const SORT_BUTTON =
  'inline-flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'

interface WeekBandRowProps {
  readonly bands: readonly WeekBand[]
  /** Zero bands means week columns, which need no band above them. */
  readonly columnCount: number
  readonly onOrder: (by: RowOrder['by']) => void
  readonly order: RowOrder
}

/**
 * The first header row: the person and total corners, and one band per ISO week.
 *
 * The corners span both header rows, so the day numbers below sit only over the
 * day columns. The person corner carries a real heading rather than being left
 * empty — axe's `empty-table-header` is in the set this suite runs, and a
 * nameless row-header column is a genuine gap for anybody listening.
 */
export function WeekBandRow({ bands, columnCount, onOrder, order }: WeekBandRowProps) {
  const { locale } = useActiveLocale()

  return (
    <tr>
      <th className={CORNER} rowSpan={2} scope="col" {...ariaSort(order, 'person')}>
        <SortButton by="person" label={m.team_column_person()} onOrder={onOrder} order={order} />
      </th>
      {bands.length === 0 ? (
        <th className={BAND} colSpan={columnCount} scope="colgroup">
          <span className="sr-only">{m.team_granularity_weeks()}</span>
        </th>
      ) : (
        bands.map((band) => (
          <th className={BAND} colSpan={band.columnCount} key={band.from} scope="colgroup">
            {/* The week number leads, and the range is what a narrow band drops:
                a two-day week at the turn of a month is sixty pixels wide, and
                "S31 …" still says which week it is where "1 de ago.…" does not. */}
            <span aria-hidden className="block truncate">
              {`${m.team_week_number({ week: band.isoWeek })} · ${formatShortDate(band.from, locale)}–${formatShortDate(band.to, locale)}`}
            </span>
            <span className="sr-only">
              {m.team_week_band({
                from: formatShortDate(band.from, locale),
                to: formatShortDate(band.to, locale),
                week: band.isoWeek,
              })}
            </span>
          </th>
        ))
      )}
      <th className={CORNER_RIGHT} rowSpan={2} scope="col" {...ariaSort(order, 'total')}>
        <SortButton by="total" label={m.team_column_total()} onOrder={onOrder} order={order} />
      </th>
    </tr>
  )
}

/** The ordering, spoken. `aria-sort` belongs on the header, not on its button. */
function ariaSort(order: RowOrder, by: RowOrder['by']) {
  if (order.by !== by) {
    return { 'aria-sort': 'none' as const }
  }

  return { 'aria-sort': order.descending ? ('descending' as const) : ('ascending' as const) }
}

function SortButton({
  by,
  label,
  onOrder,
  order,
}: {
  readonly by: RowOrder['by']
  readonly label: string
  readonly onOrder: (by: RowOrder['by']) => void
  readonly order: RowOrder
}) {
  return (
    <button
      className={SORT_BUTTON}
      onClick={() => {
        onOrder(by)
      }}
      type="button"
    >
      {label}
      <SortMark active={order.by === by} descending={order.descending} />
    </button>
  )
}

function SortMark({
  active,
  descending,
}: {
  readonly active: boolean
  readonly descending: boolean
}) {
  if (!active) {
    return null
  }

  return descending ? (
    <ArrowDown aria-hidden className="size-3" />
  ) : (
    <ArrowUp aria-hidden className="size-3" />
  )
}
