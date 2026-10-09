import { ChevronLeft, ChevronRight } from 'lucide-react'
import { lazy, Suspense } from 'react'

import { m } from '@/shared/i18n'
import { addDays, type IsoDate } from '@/shared/lib/date'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

/** Base UI keeps a disabled button focusable and marks it with this, not `:disabled`. */
const DIMMED_WHEN_DISABLED = 'data-disabled:opacity-50'

/** One size for the picker's trigger and for what stands in for it while it loads. */
const PICKER_SIZE = 'h-7 w-48'

/**
 * The picker arrives on its own, and is not in the bundle every reader downloads.
 *
 * The dashboard is the first screen, so whatever it imports eagerly is the
 * initial load, and that is 195.5 kB of a 196 kB budget. The calendar and the
 * popup machinery under it are what the team screen measured at 34 kB hoisted
 * into the entry when imported eagerly; loaded here they are a chunk of their
 * own, fetched as the dashboard mounts. Mapped to `default` rather than exported
 * as one, because `no-restricted-exports` holds every module here.
 */
const DayPicker = lazy(async () =>
  import('./day-picker').then((module) => ({ default: module.DayPicker })),
)

interface DayControlProps {
  /** The day the screen is read as of. */
  readonly day: IsoDate
  readonly onChoose: (day: IsoDate) => void
  readonly today: IsoDate
}

/**
 * Which day the dashboard is read as of: the day before, the day itself, the
 * day after, and the way back to today.
 *
 * One bordered `h-9` strip, the same shape as the month stepper on the team
 * screen and on insights, with the day in the middle opening a calendar.
 *
 * Nothing after today is offered, and the two controls that would go there are
 * disabled rather than removed — and stay focusable while disabled, because a
 * keyboard reader stepping forward lands on today with focus on the button that
 * took them there, and a control that vanished or blurred under them would drop
 * focus on the page.
 */
export function DayControl({ day, onChoose, today }: DayControlProps) {
  const atToday = day >= today

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex h-9 items-center gap-1 rounded-lg border border-input px-1">
        <Button
          aria-label={m.dashboard_day_previous()}
          onClick={() => {
            onChoose(addDays(day, -1))
          }}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </Button>
        <Suspense fallback={<Skeleton className={PICKER_SIZE} />}>
          <DayPicker className={PICKER_SIZE} day={day} onChoose={onChoose} today={today} />
        </Suspense>
        <Button
          aria-label={m.dashboard_day_next()}
          className={DIMMED_WHEN_DISABLED}
          disabled={atToday}
          focusableWhenDisabled
          onClick={() => {
            onChoose(addDays(day, 1))
          }}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ChevronRight aria-hidden className="size-4" />
        </Button>
      </div>
      <Button
        className={DIMMED_WHEN_DISABLED}
        disabled={atToday}
        focusableWhenDisabled
        onClick={() => {
          onChoose(today)
        }}
        size="lg"
        type="button"
        variant="outline"
      >
        {m.dashboard_back_to_today()}
      </Button>
    </div>
  )
}
