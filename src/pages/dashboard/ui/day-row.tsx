import { ChevronRight } from 'lucide-react'

import type { DayTotal } from '@/entities/timelogs'

import { m, useActiveLocale } from '@/shared/i18n'
import { weekdayOf } from '@/shared/lib/date'
import { formatHours, formatLongDate, formatSpokenHours, weekdayName } from '@/shared/lib/format'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible'

import { WorkItemRow } from './work-item-row'

const PERCENT = 100

interface DayRowProps {
  readonly day: DayTotal
  /** Hours a full-width bar stands for, shared by every row of the feed. */
  readonly scale: number
}

/**
 * One day of the feed, opening into what was worked on.
 *
 * Every row's bar is drawn on the same scale, so the list can be read by
 * comparing its rows rather than by reading each number.
 */
export function DayRow({ day, scale }: DayRowProps) {
  const { locale } = useActiveLocale()

  return (
    <Collapsible className="border-b last:border-b-0">
      <CollapsibleTrigger className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90"
        />
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium">{formatLongDate(day.date, locale)}</span>
          <span className="text-xs text-muted-foreground">
            {weekdayName(weekdayOf(day.date), locale)}
          </span>
        </span>
        {scale > 0 ? (
          <span
            aria-hidden
            className="ml-auto hidden h-1.5 w-32 rounded-full bg-chart-empty sm:block"
          >
            <span
              className="block h-full rounded-full bg-chart-bar"
              style={{ width: `${String(barWidth(day.hours, scale))}%` }}
            />
          </span>
        ) : null}
        <span
          aria-label={formatSpokenHours(day.hours, locale)}
          className="tabular ml-auto w-16 shrink-0 text-right font-medium sm:ml-0"
        >
          {formatHours(day.hours, locale)}
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">
            {m.hours_short()}
          </span>
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="px-4 pb-3 pl-11">
          {day.items.map((item) => (
            <WorkItemRow item={item} key={item.workItem?.reference ?? item.project.fullPath} />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Capped at the full width, so a day past the reference does not overflow. */
function barWidth(hours: number, scale: number): number {
  return Math.min(hours / scale, 1) * PERCENT
}
