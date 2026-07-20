import { formatHours } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

/** Jornada de referencia: a barra cheia representa 8h. */
const REFERENCE_HOURS = 8

type HoursBarProps = {
  className?: string
  hours: number
}

/** Medidor de horas do dia, escalado contra uma jornada de 8h. Acima de 8h a ponta fica ambar. */
export function HoursBar({ className, hours }: HoursBarProps) {
  const ratio = Math.min(Math.max(hours, 0) / REFERENCE_HOURS, 1)
  const overtime = hours > REFERENCE_HOURS

  return (
    <div
      aria-hidden
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
      title={`${formatHours(hours)} de ${REFERENCE_HOURS}h de referencia`}
    >
      <div className="h-full rounded-full bg-tanuki" style={{ width: `${ratio * 100}%` }} />
      {overtime && <div className="absolute inset-y-0 right-0 w-1 rounded-full bg-tanuki-amber" />}
    </div>
  )
}
