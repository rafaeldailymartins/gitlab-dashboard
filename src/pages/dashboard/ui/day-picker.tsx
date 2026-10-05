import { CalendarDays, ChevronDown } from 'lucide-react'
import { useRef, useState } from 'react'

import { m, useActiveLocale } from '@/shared/i18n'
import { type IsoDate, toIsoDate, weekdayOf } from '@/shared/lib/date'
import {
  formatFullDate,
  formatMediumDate,
  formatMonth,
  shortWeekdayName,
  weekdayName,
} from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { buttonVariants } from '@/shared/ui/button'
import { Calendar } from '@/shared/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

/**
 * The calendar is told every day is a day at UTC midnight, and reads its answers
 * back the same way, so no instant ever crosses a zone on its way in or out: a
 * picked square is a calendar date, and `toIsoDate` in UTC returns exactly it.
 */
const CALENDAR_ZONE = 'UTC'

/** The square of the day on screen, as the calendar marks it. */
const SHOWN_DAY = '[data-selected-single="true"]'

interface DayPickerProps {
  /** The trigger's size, which whatever stands in for it while it loads shares. */
  readonly className: string
  readonly day: IsoDate
  readonly onChoose: (day: IsoDate) => void
  readonly today: IsoDate
}

/**
 * The day on screen, as a control that opens a month to pick another from.
 *
 * It replaced the platform's date input, which wrote the date in the
 * *browser's* locale — an English screen on a Brazilian machine read
 * 02/10/2026 — and drew a native field in the middle of the app's own controls.
 * This one names the day the way every other date here is named, through
 * `Intl` in the app's language, and opens the same kind of panel the report's
 * pickers open.
 *
 * Picking is one action, so it commits at once and closes; there is no typing
 * to wait out. Nothing after today can be picked, and no month after this one
 * can be paged to.
 */
export function DayPicker({ className, day, onChoose, today }: DayPickerProps) {
  const [open, setOpen] = useState(false)
  const month = useRef<HTMLDivElement>(null)
  const { locale } = useActiveLocale()

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ size: 'sm', variant: 'ghost' }),
          className,
          'tabular justify-start font-normal',
        )}
      >
        <CalendarDays aria-hidden className="text-muted-foreground" />
        <span>
          <span className="sr-only">{`${m.dashboard_day_field()}: `}</span>
          {formatMediumDate(day, locale)}
        </span>
        <ChevronDown aria-hidden className="ms-auto text-muted-foreground" />
      </PopoverTrigger>
      {/* Focus lands on the day shown, which is where the arrow keys start from,
          rather than on the first control in the panel — the previous-month
          button, one key press from paging away from it. */}
      <PopoverContent
        align="center"
        className="w-auto p-1"
        initialFocus={() => month.current?.querySelector<HTMLElement>(SHOWN_DAY) ?? true}
      >
        <div ref={month}>
          <Calendar
            defaultMonth={atMidnight(day)}
            disabled={{ after: atMidnight(today) }}
            endMonth={atMidnight(today)}
            formatters={{
              formatCaption: (date) => formatMonth(dayOf(date), locale),
              formatWeekdayName: (date) => shortWeekdayName(weekdayOf(dayOf(date)), locale),
            }}
            labels={labelsFor(locale)}
            lang={locale}
            mode="single"
            onSelect={(date) => {
              setOpen(false)
              onChoose(dayOf(date))
            }}
            required
            selected={atMidnight(day)}
            timeZone={CALENDAR_ZONE}
            today={atMidnight(today)}
            weekStartsOn={1}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function atMidnight(day: IsoDate): Date {
  return new Date(`${day}T00:00:00Z`)
}

function dayOf(date: Date): IsoDate {
  return toIsoDate(date, CALENDAR_ZONE)
}

/**
 * What assistive technology hears, in the app's language. The calendar's own
 * defaults are date-fns' English whatever the screen is in.
 */
function labelsFor(locale: string) {
  return {
    labelDayButton: (date: Date, modifiers: { selected?: boolean; today?: boolean }) =>
      [
        formatFullDate(dayOf(date), locale),
        modifiers.today === true ? m.dashboard_today() : null,
        modifiers.selected === true ? m.dashboard_calendar_selected() : null,
      ]
        .filter((part) => part !== null)
        .join(', '),
    labelGrid: (date: Date) => formatMonth(dayOf(date), locale),
    labelNav: () => m.dashboard_calendar_months(),
    labelNext: () => m.dashboard_calendar_next(),
    labelPrevious: () => m.dashboard_calendar_previous(),
    labelWeekday: (date: Date) => weekdayName(weekdayOf(dayOf(date)), locale),
  }
}
