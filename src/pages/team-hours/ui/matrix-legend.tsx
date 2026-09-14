import type { ReactNode } from 'react'

import { m, useActiveLocale } from '@/shared/i18n'
import { formatHours } from '@/shared/lib/format'

import type { LegendShows } from '../lib/legend'

interface MatrixLegendProps {
  readonly reference: number
  readonly shows: LegendShows
}

/**
 * What the marks mean, and what they are measured against.
 *
 * The reference is stated rather than assumed. The app has no way of knowing
 * anybody's working arrangement, so a bar drawn against an unstated one would be
 * the screen asserting something about a colleague's contract.
 *
 * Only the marks this report actually uses are listed. A key for something that
 * is nowhere in the table sends the reader looking for it. The reference is always listed: it explains every figure there is.
 */
export function MatrixLegend({ reference, shows }: MatrixLegendProps) {
  const { locale } = useActiveLocale()

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
      <Item>
        <span aria-hidden className="flex h-1 items-stretch">
          <span className="w-5 rounded-l-sm bg-chart-empty">
            <span className="block h-full w-3/4 rounded-l-sm bg-chart-bar" />
          </span>
          <span className="w-2 border-l border-dashed border-chart-target" />
        </span>
        {m.team_reference_legend({ hours: formatHours(reference, locale) })}
      </Item>
      {shows.over ? (
        <Item>
          <span aria-hidden className="flex h-1 items-stretch">
            <span className="w-5 rounded-l-sm bg-chart-bar" />
            <span className="w-2 border-l border-dashed border-chart-target">
              <span className="block h-full w-1/2 rounded-r-sm bg-chart-bar" />
            </span>
          </span>
          {m.team_legend_over()}
        </Item>
      ) : null}
      {shows.unlogged ? (
        <Item>
          <span
            aria-hidden
            className="inline-block h-2 w-3 border-b border-dashed border-chart-target opacity-60"
          />
          {m.team_legend_unlogged()}
        </Item>
      ) : null}
      {shows.nonWorking ? (
        <Item>
          <span aria-hidden className="size-3 rounded-sm bg-chart-empty" />
          {m.team_legend_non_working()}
        </Item>
      ) : null}
    </div>
  )
}

function Item({ children }: { readonly children: ReactNode }) {
  return <span className="flex items-center gap-1.5">{children}</span>
}
