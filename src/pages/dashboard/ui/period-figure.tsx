import { useId } from 'react'

import type { PeriodSummary } from '@/entities/timelogs'

import { targetProgress } from '@/entities/preferences'
import { m, useActiveLocale } from '@/shared/i18n'
import { formatHours } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { HourFigure } from '@/shared/ui/hour-figure'

interface PeriodFigureProps {
  readonly label: string
  readonly summary: PeriodSummary
  readonly target: number
  /** True before anything has loaded, when zero would be a guess. */
  readonly waiting: boolean
}

const PERCENT = 100

/**
 * One period's hours against its target.
 *
 * The figure is a group named by its own label, so assistive technology reads
 * "This week, 7.7 hours" rather than a number with nothing attached to it. The
 * bar is decoration over that: everything it shows is also written out.
 *
 * A total that is not yet settled says so — the loaded history does not reach
 * back to the start of the period, so the figure is a floor, and presenting it
 * as final would understate the reader's hours.
 */
export function PeriodFigure({ label, summary, target, waiting }: PeriodFigureProps) {
  const { locale } = useActiveLocale()
  const labelId = useId()
  const progress = targetProgress(summary.hours, target)

  return (
    <div aria-labelledby={labelId} className="rounded-lg border bg-card p-4" role="group">
      <dl>
        <dt className="text-sm text-muted-foreground" id={labelId}>
          {label}
        </dt>
        <dd className="mt-1 flex flex-col gap-2">
          <span className="flex items-baseline gap-1.5">
            {waiting ? (
              <>
                <span aria-hidden className="h-8 w-16 animate-pulse rounded bg-muted" />
                <span aria-hidden className="text-sm text-muted-foreground">
                  {m.hours_short()}
                </span>
              </>
            ) : (
              <HourFigure
                className="tabular text-3xl font-semibold"
                hours={summary.hours}
                unitClassName="text-sm text-muted-foreground"
              />
            )}
            <span className="ml-1 text-xs text-muted-foreground">
              {target > 0
                ? m.dashboard_of_target({ target: formatHours(target, locale) })
                : m.dashboard_no_target()}
            </span>
          </span>
          {progress.ratio === null ? null : (
            /* Chart tokens, not interface ones: this is a bar, and the pair that
               was validated for a bar inside a track is `--chart-bar` on
               `--chart-empty`. `bg-primary` on `bg-muted` measured 2.69:1 on
               dark, with a track invisible against the card behind it. */
            <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-chart-empty">
              <span
                className="block h-full rounded-full bg-chart-bar"
                style={{ width: `${String(progress.ratio * PERCENT)}%` }}
              />
            </span>
          )}
          {waiting || progress.ratio === null ? null : (
            /* Brass once the target is reached: the seal on a closed entry. It
               is the only colour in the interface that means a state, and the
               sentence beside it says the same thing in words. */
            <span className={cn('text-xs', progress.isMet ? 'text-seal' : 'text-muted-foreground')}>
              {balanceText(progress.balanceHours, locale)}
            </span>
          )}
        </dd>
      </dl>
      {summary.settled ? null : (
        <p className="text-xs text-muted-foreground">{m.dashboard_still_loading()}</p>
      )}
    </div>
  )
}

function balanceText(balanceHours: number, locale: string): string {
  if (balanceHours === 0) {
    return m.dashboard_target_met()
  }

  const hours = formatHours(Math.abs(balanceHours), locale)

  return balanceHours > 0
    ? m.dashboard_above_target({ hours })
    : m.dashboard_below_target({ hours })
}
