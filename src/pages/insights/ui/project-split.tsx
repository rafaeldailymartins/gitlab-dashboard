import { type DayTotal, type OtherProjects, projectSplit } from '@/entities/timelogs'
import { m } from '@/shared/i18n'
import { HourFigure } from '@/shared/ui/hour-figure'

const PERCENT = 100

/**
 * Assigned in this fixed order and never cycled, so a project keeps its colour
 * when the set changes. Anything past the last slot folds into one neutral row
 * rather than borrowing a colour that already means another project.
 */
const SERIES_CLASS = [
  'bg-chart-series-1',
  'bg-chart-series-2',
  'bg-chart-series-3',
  'bg-chart-series-4',
  'bg-chart-series-5',
  'bg-chart-series-6',
] as const

interface RowProps {
  readonly bar: string
  readonly detail?: string
  readonly hours: number
  readonly label: string
  readonly share: number
}

/**
 * Where the period's hours went, by project.
 *
 * Every bar carries its project and its hours as text beside it: three of the
 * six colours sit below 3:1 on a light card, so the label is what carries the
 * meaning and the colour only ties the row to its share of the whole.
 */
export function ProjectSplit({ days }: { readonly days: readonly DayTotal[] }) {
  const split = projectSplit(days, SERIES_CLASS.length)

  if (split.top.length === 0) {
    return <p className="text-sm text-muted-foreground">{m.insights_nothing_in_period()}</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {split.top.map((total, rank) => (
        <Row
          bar={SERIES_CLASS[rank] ?? SERIES_CLASS[0]}
          detail={total.project.fullPath}
          hours={total.hours}
          key={total.project.fullPath}
          label={total.project.name}
          share={total.share}
        />
      ))}
      {split.others ? <Others others={split.others} /> : null}
    </ul>
  )
}

function Others({ others }: { readonly others: OtherProjects }) {
  return (
    <Row
      bar="bg-chart-target"
      hours={others.hours}
      label={m.insights_other_projects({ count: others.count })}
      share={others.share}
    />
  )
}

function Row({ bar, detail, hours, label, share }: RowProps) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2 text-sm">
        <span className="min-w-0 truncate font-medium">{label}</span>
        <span className="tabular ml-auto shrink-0">
          <HourFigure hours={hours} unitClassName="ml-0.5 text-xs text-muted-foreground" />
        </span>
      </div>
      <span aria-hidden className="h-2 overflow-hidden rounded-full bg-chart-empty">
        <span
          className={`block h-full rounded-full ${bar}`}
          style={{ width: `${String(share * PERCENT)}%` }}
        />
      </span>
      {detail === undefined ? null : (
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      )}
    </li>
  )
}
