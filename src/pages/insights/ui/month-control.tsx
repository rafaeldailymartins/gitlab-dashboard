import { ChevronLeft, ChevronRight } from 'lucide-react'

import { m, useActiveLocale } from '@/shared/i18n'
import { addDays, endOfMonth, type IsoDate, startOfMonth } from '@/shared/lib/date'
import { formatMonth } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'

/** Base UI keeps a disabled button focusable and marks it with this, not `:disabled`. */
const DIMMED_WHEN_DISABLED = 'data-disabled:opacity-50'

interface MonthControlProps {
  /** The first day of the month on screen. */
  readonly month: IsoDate
  readonly onChoose: (month: IsoDate) => void
  /** The first day of the current month. */
  readonly thisMonth: IsoDate
}

/**
 * Which month insights shows: the one before, the one on screen, the one
 * after, and the way back to this month.
 *
 * A stepper around the month's name, as on the team screen, rather than the
 * platform's month input: desktop Firefox and Safari draw that one as a plain
 * text box. Nothing after the current month is offered, and the controls that
 * would go there are disabled and still focusable, so stepping forward onto
 * the current month leaves focus where the reader pressed.
 */
export function MonthControl({ month, onChoose, thisMonth }: MonthControlProps) {
  const { locale } = useActiveLocale()
  const atThisMonth = month >= thisMonth

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex h-9 items-center gap-1 rounded-lg border border-input px-1">
        <Button
          aria-label={m.insights_month_previous()}
          onClick={() => {
            onChoose(startOfMonth(addDays(month, -1)))
          }}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </Button>
        <span className="tabular min-w-40 text-center text-sm">{formatMonth(month, locale)}</span>
        <Button
          aria-label={m.insights_month_next()}
          className={DIMMED_WHEN_DISABLED}
          disabled={atThisMonth}
          focusableWhenDisabled
          onClick={() => {
            onChoose(addDays(endOfMonth(month), 1))
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
        disabled={atThisMonth}
        focusableWhenDisabled
        onClick={() => {
          onChoose(thisMonth)
        }}
        size="lg"
        type="button"
        variant="outline"
      >
        {m.insights_back_to_current_month()}
      </Button>
    </div>
  )
}
