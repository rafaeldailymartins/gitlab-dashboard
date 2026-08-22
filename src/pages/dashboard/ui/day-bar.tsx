import type { IsoDate } from '@/shared/lib/date'

import { m, useActiveLocale } from '@/shared/i18n'
import { formatHours, formatSpokenHours, shortWeekdayName } from '@/shared/lib/format'

import type { WeekDay } from '../lib/week-days'

const PERCENT = 100

interface DayBarProps {
  readonly day: WeekDay
  readonly onSelect: (date: IsoDate) => void
}

/**
 * One day of the week strip.
 *
 * The bar is decoration: the hours are printed above it and the accessible name
 * says the weekday, the hours and the target, so nothing here is carried by
 * height or colour alone. Today is marked with `aria-current`, which is the same
 * fact the filled label carries visually.
 */
export function DayBar({ day, onSelect }: DayBarProps) {
  const { locale } = useActiveLocale()

  return (
    <li className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span className="tabular text-xs text-muted-foreground">
        {day.hours > 0 ? formatHours(day.hours, locale) : ''}
      </span>
      <button
        aria-label={spokenLabel(day, locale)}
        className="group relative flex h-16 w-full items-end justify-center rounded-sm bg-chart-empty focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        onClick={() => {
          onSelect(day.date)
        }}
        type="button"
        {...(day.isToday ? { 'aria-current': 'date' as const } : {})}
      >
        {day.targetRatio > 0 ? (
          <span
            aria-hidden
            className="absolute inset-x-0 border-t border-dashed border-chart-target"
            style={{ bottom: `${String(day.targetRatio * PERCENT)}%` }}
          />
        ) : null}
        <span
          aria-hidden
          className="w-full rounded-sm bg-chart-bar transition-[height] group-hover:opacity-80"
          style={{ height: `${String(day.ratio * PERCENT)}%` }}
        />
      </button>
      <span
        className={
          day.isToday
            ? 'rounded-sm bg-primary px-1.5 text-xs font-medium text-primary-foreground'
            : 'px-1.5 text-xs text-muted-foreground'
        }
      >
        {shortWeekdayName(day.weekday, locale)}
      </span>
    </li>
  )
}

function spokenLabel(day: WeekDay, locale: string): string {
  const hours = formatSpokenHours(day.hours, locale)
  const weekday = shortWeekdayName(day.weekday, locale)

  return day.targetHours > 0
    ? m.week_strip_day_with_target({
        hours,
        target: formatHours(day.targetHours, locale),
        weekday,
      })
    : m.week_strip_day_without_target({ hours, weekday })
}
