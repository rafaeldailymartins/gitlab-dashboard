import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo } from 'react'

import { type DayTotal, type ItemTotal, itemTotals } from '@/entities/timelogs'
import { m, useActiveLocale } from '@/shared/i18n'
import { formatHours } from '@/shared/lib/format'

import { ItemCell } from './item-cell'

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
})

const helper = createColumnHelper<typeof features, ItemTotal>()

/** Hours and days are numbers, so they line up on the right and use tabular figures. */
const NUMERIC = new Set(['days', 'hours'])

/**
 * What the period went into, sortable by any column.
 *
 * It opens sorted by hours, descending: the question a reader comes here with is
 * "what took the time", and the answer should not need a click first.
 */
export function TopItemsTable({ days }: { readonly days: readonly DayTotal[] }) {
  const { locale } = useActiveLocale()
  const data = useMemo(() => itemTotals(days), [days])
  const columns = useMemo(() => buildColumns(locale), [locale])

  const table = useTable({
    columns,
    data,
    features,
    initialState: { sorting: [{ desc: true, id: 'hours' }] },
  })

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{m.insights_nothing_in_period()}</p>
  }

  return (
    <table className="w-full table-fixed text-sm">
      <colgroup>
        <col className="w-[46%]" />
        <col className="w-[24%]" />
        <col className="w-[12%]" />
        <col className="w-[18%]" />
      </colgroup>
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr className="border-b" key={group.id}>
            {group.headers.map((header) => (
              <th
                className={`py-2 font-medium text-muted-foreground ${alignOf(header.column.id)}`}
                key={header.id}
                scope="col"
              >
                <button
                  className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  onClick={header.column.getToggleSortingHandler()}
                  type="button"
                >
                  <table.FlexRender header={header} />
                  <SortMark direction={header.column.getIsSorted()} />
                </button>
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr className="border-b last:border-b-0" key={row.id}>
            {row.getAllCells().map((cell) => (
              <td className={`py-2 ${alignOf(cell.column.id)}`} key={cell.id}>
                <table.FlexRender cell={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function alignOf(columnId: string): string {
  return NUMERIC.has(columnId) ? 'tabular text-right' : 'truncate pr-3 text-left'
}

function buildColumns(locale: string) {
  return helper.columns([
    helper.accessor((item) => item.workItem?.title ?? m.day_unattributed(), {
      cell: (info) => <ItemCell item={info.row.original} />,
      header: m.insights_column_item(),
      id: 'item',
      sortFn: 'alphanumeric',
    }),
    helper.accessor((item) => item.project.name, {
      header: m.insights_column_project(),
      id: 'project',
      sortFn: 'alphanumeric',
    }),
    helper.accessor((item) => item.days, {
      header: m.insights_column_days(),
      id: 'days',
      sortFn: 'basic',
    }),
    helper.accessor((item) => item.hours, {
      cell: (info) => formatHours(info.getValue(), locale),
      header: m.insights_column_hours(),
      id: 'hours',
      sortFn: 'basic',
    }),
  ])
}

function SortMark({ direction }: { readonly direction: 'asc' | 'desc' | false }) {
  if (!direction) {
    return null
  }

  return direction === 'asc' ? (
    <ArrowUp aria-hidden className="size-3" />
  ) : (
    <ArrowDown aria-hidden className="size-3" />
  )
}
