import type { Weekday } from '@/shared/lib/date'

import { useActiveLocale } from '@/shared/i18n'
import { shortWeekdayName } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

interface ArtRow {
  readonly quiet: boolean
  readonly ratio: number
  readonly weekday: Weekday
}

/**
 * A working week, ending on a day that is still going. Proportions only: the
 * sign-in screen has no data to show, and printing figures nobody logged would
 * be a lie dressed as a chart.
 */
const ART_ROWS: readonly ArtRow[] = [
  { quiet: false, ratio: 0.72, weekday: 1 },
  { quiet: false, ratio: 0.94, weekday: 2 },
  { quiet: false, ratio: 0.61, weekday: 3 },
  { quiet: false, ratio: 0.88, weekday: 4 },
  { quiet: true, ratio: 0.34, weekday: 5 },
]

/**
 * The shape of the day feed, standing in for a screenshot.
 *
 * Hidden from assistive technology on purpose: it is the product's silhouette,
 * not information, and the weekday names are here so the drawing belongs to the
 * reader's language rather than to English.
 */
export function FeedArt() {
  const { locale } = useActiveLocale()

  return (
    <div aria-hidden className="flex flex-col">
      {ART_ROWS.map((row) => (
        <div className="flex items-center gap-4 border-t py-2.5 sm:py-3.5" key={row.weekday}>
          <span className="w-10 font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase">
            {shortWeekdayName(row.weekday, locale)}
          </span>
          <span className="h-1.5 flex-1 rounded-full bg-chart-empty">
            <span
              className={cn(
                'block h-full rounded-full',
                row.quiet ? 'bg-chart-bar/40' : 'bg-chart-bar',
              )}
              style={{ width: `${String(row.ratio * 100)}%` }}
            />
          </span>
        </div>
      ))}
    </div>
  )
}
