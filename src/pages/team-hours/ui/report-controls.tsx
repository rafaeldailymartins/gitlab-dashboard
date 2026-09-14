import { ChevronLeft, ChevronRight } from 'lucide-react'

import type { Granularity } from '@/entities/group-timelogs'

import { m, useActiveLocale } from '@/shared/i18n'
import { formatMonth } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'

import type { TeamSearch } from '../lib/search-params'

import { monthDateOf, shiftMonth } from '../lib/search-params'

const SEGMENT =
  'rounded-md px-3 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:bg-primary aria-pressed:font-medium aria-pressed:text-primary-foreground'

interface ReportControlsProps {
  readonly onChange: (search: Partial<TeamSearch>) => void
  readonly search: TeamSearch
}

/**
 * Which month, and how wide a column is.
 *
 * Both live in the address rather than in state, so the view a reader is looking
 * at is the view they can send somebody else — which is the whole reason this
 * screen is addressable.
 */
export function ReportControls({ onChange, search }: ReportControlsProps) {
  const { locale } = useActiveLocale()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-lg border border-input px-1 py-0.5">
        <Button
          aria-label={m.team_month_previous()}
          onClick={() => {
            onChange({ month: shiftMonth(search.month, -1) })
          }}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </Button>
        <span className="tabular min-w-40 text-center text-sm">
          {formatMonth(monthDateOf(search), locale)}
        </span>
        <Button
          aria-label={m.team_month_next()}
          onClick={() => {
            onChange({ month: shiftMonth(search.month, 1) })
          }}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ChevronRight aria-hidden className="size-4" />
        </Button>
      </div>

      <div
        aria-label={m.team_granularity_label()}
        className="flex items-center gap-0.5 rounded-lg border border-input p-0.5"
        role="group"
      >
        <GranularityButton
          by="days"
          label={m.team_granularity_days()}
          onChange={onChange}
          search={search}
        />
        <GranularityButton
          by="weeks"
          label={m.team_granularity_weeks()}
          onChange={onChange}
          search={search}
        />
      </div>
    </div>
  )
}

function GranularityButton({
  by,
  label,
  onChange,
  search,
}: ReportControlsProps & {
  readonly by: Granularity
  readonly label: string
}) {
  return (
    <button
      aria-pressed={search.by === by}
      className={SEGMENT}
      onClick={() => {
        onChange({ by })
      }}
      type="button"
    >
      {label}
    </button>
  )
}
