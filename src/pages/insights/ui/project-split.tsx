import {
  type DayTotal,
  NO_PROJECT,
  type OtherProjects,
  projectName,
  projectSplit,
} from '@/entities/timelogs'
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
 * Every bar carries its project and its hours as text beside it. All six colours
 * clear 3:1 on their surface, so this is not about contrast: across rows that do
 * not touch, the hues collapse under deutan — brass against brick measures ΔE
 * 4.4 — and a reader comparing the first row with the fifth has only the label.
 * So the label carries the meaning and the colour only ties the row to its share
 * of the whole.
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
          hours={total.hours}
          key={total.project?.fullPath ?? NO_PROJECT}
          label={projectName(total.project)}
          share={total.share}
          // No detail for the group with no readable project: the path would
          // repeat the label word for word, and there is no path to show.
          {...(total.project ? { detail: total.project.fullPath } : {})}
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
