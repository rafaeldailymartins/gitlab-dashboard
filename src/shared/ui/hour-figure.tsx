import { m, useActiveLocale } from '@/shared/i18n'
import { formatHours, formatSpokenHours } from '@/shared/lib/format'

interface HourFigureProps {
  readonly className?: string
  readonly hours: number
  readonly unitClassName: string
}

/**
 * An hour figure that reads well and is spoken well.
 *
 * The digits and the unit abbreviation are hidden from assistive technology and
 * the spoken form sits beside them. `aria-label` would be the shorter route and
 * is wrong: naming is prohibited on a generic element, so a screen reader
 * ignores the label and reads "6.7 h" as the digits and the letter. Testing
 * Library computes the name anyway, which is how that mistake survives a green
 * suite.
 */
export function HourFigure({ className, hours, unitClassName }: HourFigureProps) {
  const { locale } = useActiveLocale()

  return (
    <>
      <span aria-hidden className={className}>
        {formatHours(hours, locale)}
      </span>
      <span aria-hidden className={unitClassName}>
        {m.hours_short()}
      </span>
      <span className="sr-only">{formatSpokenHours(hours, locale)}</span>
    </>
  )
}
