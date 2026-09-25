import type { ReactNode } from 'react'

import { m } from '@/shared/i18n'

import type { LegendShows } from '../lib/legend'

interface MatrixLegendProps {
  /**
   * True when the figures are narrowed to a group.
   *
   * The key explains the same mark under both reaches and may not make the same
   * claim about it. The cells were split in two for this reason; the legend is
   * the one place on the screen that still said the unqualified thing, and a key
   * is read as the authority on what a mark means.
   */
  readonly scoped: boolean
  readonly shows: LegendShows
}

/**
 * What the marks mean, and what they are measured against.
 *
 * The reference is stated rather than assumed. It is the reader's own working
 * hours, which vary by weekday and so have no single number to name here; what
 * the key says instead is that each bar is measured against that day's target —
 * the reader's own daily target, the same words Settings and the dashboard use.
 *
 * Only the marks this report actually uses are listed. A key for something that
 * is nowhere in the table sends the reader looking for it. The reference is always listed: it explains every figure there is.
 */
export function MatrixLegend({ scoped, shows }: MatrixLegendProps) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
      <Item>
        <span aria-hidden className="flex h-1 items-stretch">
          <span className="w-5 rounded-l-sm bg-chart-empty">
            <span className="block h-full w-3/4 rounded-l-sm bg-chart-bar" />
          </span>
          <span className="w-2 border-l border-dashed border-chart-target" />
        </span>
        {m.team_reference_legend()}
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
          {scoped ? m.team_legend_unlogged_in_group() : m.team_legend_unlogged_anywhere()}
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
