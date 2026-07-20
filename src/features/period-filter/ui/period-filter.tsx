import { cn } from '@/shared/lib/utils'

export const DAYS_OPTIONS = [7, 15, 30, 60, 90] as const

type PeriodFilterProps = {
  onChange: (days: number) => void
  value: number
}

export function PeriodFilter({ onChange, value }: PeriodFilterProps) {
  return (
    <div aria-label="Periodo em dias" className="flex w-fit rounded-md border bg-card p-0.5 shadow-sm" role="group">
      {DAYS_OPTIONS.map((option) => (
        <button
          aria-pressed={value === option}
          className={cn(
            'h-8 rounded-[calc(var(--radius)-4px)] px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
            value === option && 'bg-primary text-primary-foreground hover:text-primary-foreground',
          )}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option}d
        </button>
      ))}
    </div>
  )
}
