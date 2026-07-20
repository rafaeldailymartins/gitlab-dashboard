import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowUpDown, CalendarDays, ChevronRight } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'

import type { DayRow } from '@/entities/timelog'
import { formatDateLabel, formatHours, formatInteger } from '@/shared/lib/format'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

import { HoursBar } from './hours-bar'

type DailyHoursTableProps = {
  loading: boolean
  onOpenDay: (date: string) => void
  rows: DayRow[]
  /** Exibe a coluna "Pessoas" (visao sem filtro de usuario). */
  showUsers: boolean
}

export function DailyHoursTable({ loading, onOpenDay, rows, showUsers }: DailyHoursTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ desc: true, id: 'date' }])
  const columns = useMemo(() => buildColumns(showUsers), [showUsers])
  const table = useReactTable({
    columns,
    data: rows,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  })

  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
        <h2 className="font-display text-sm font-semibold">Horas por dia</h2>
        <span className="text-xs text-muted-foreground">{formatInteger(rows.length)} dias com registros</span>
      </div>

      {loading ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton className="h-10 w-full" key={index} />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  className="cursor-pointer focus-within:bg-muted/60 hover:bg-accent/50"
                  key={row.id}
                  onClick={() => onOpenDay(row.original.date)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onOpenDay(row.original.date)
                    }
                  }}
                  role="link"
                  tabIndex={0}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="h-24 text-center text-muted-foreground" colSpan={columns.length}>
                  Nenhum registro de tempo no periodo. Ajuste o periodo ou o filtro de usuario.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </section>
  )
}

function buildColumns(showUsers: boolean): ColumnDef<DayRow>[] {
  const columns: ColumnDef<DayRow>[] = [
    {
      accessorKey: 'date',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className="font-medium">{formatDateLabel(row.original.date)}</span>
        </div>
      ),
      header: ({ column }) => <SortableHeader column={column}>Dia</SortableHeader>,
    },
    {
      accessorKey: 'hours',
      cell: ({ row }) => (
        <div className="w-36 space-y-1.5">
          <span className="font-semibold tabular-nums">{formatHours(row.original.hours)}</span>
          <HoursBar hours={row.original.hours} />
        </div>
      ),
      header: ({ column }) => <SortableHeader column={column}>Horas</SortableHeader>,
    },
    {
      accessorKey: 'entryCount',
      cell: ({ row }) => <span className="tabular-nums">{formatInteger(row.original.entryCount)}</span>,
      header: ({ column }) => <SortableHeader column={column}>Registros</SortableHeader>,
    },
  ]

  if (showUsers) {
    columns.push({
      cell: ({ row }) => <span className="tabular-nums">{formatInteger(row.original.users.length)}</span>,
      header: ({ column }) => <SortableHeader column={column}>Pessoas</SortableHeader>,
      id: 'userCount',
      accessorFn: (row) => row.users.length,
    })
  }

  columns.push(
    {
      cell: ({ row }) => (
        <div className="flex max-w-md flex-wrap gap-1.5">
          {row.original.items.slice(0, 3).map((item) => (
            <Badge key={item.key} variant="secondary">
              {item.key} · {formatHours(item.hours)}
            </Badge>
          ))}
        </div>
      ),
      header: () => <span>Maiores itens do dia</span>,
      id: 'topItems',
    },
    {
      cell: () => (
        <div className="flex justify-end text-muted-foreground">
          <ChevronRight className="size-4" />
        </div>
      ),
      header: () => null,
      id: 'open',
    },
  )

  return columns
}

function SortableHeader({
  children,
  column,
}: {
  children: ReactNode
  column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: (desc?: boolean) => void }
}) {
  return (
    <Button
      className="-ml-3 h-8 px-3"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      type="button"
      variant="ghost"
    >
      {children}
      <ArrowUpDown />
    </Button>
  )
}
