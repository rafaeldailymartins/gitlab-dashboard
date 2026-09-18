import type { PeriodTotal } from '@/entities/team-timelogs'

import { m } from '@/shared/i18n'
import { HourFigure } from '@/shared/ui/hour-figure'

import type { ColumnMarks } from '../lib/marks'

import { dividerFor } from '../lib/marks'

const FOOT =
  'relative sticky bottom-0 z-25 h-10 border-t-2 border-border bg-card text-xs font-semibold'

const FOOT_LEFT = `${FOOT} left-0 z-35 w-56 min-w-56 max-w-56 border-r px-3 text-left text-muted-foreground`

const FOOT_RIGHT = `${FOOT} right-0 z-35 w-24 min-w-24 border-l px-3 text-right`

interface MatrixFootProps {
  readonly columnTotals: readonly PeriodTotal[]
  /** True once the whole period has been read, so a total is an answer. */
  readonly complete: boolean
  readonly grandTotal: PeriodTotal
  readonly keys: readonly string[]
  readonly marks: ColumnMarks
}

/**
 * What the whole group logged, per column and in total.
 *
 * Sticky to the bottom of the scroll region, so the day a nobody logged stays
 * readable however far down a large group the reader has scrolled.
 */
export function MatrixFoot({ columnTotals, complete, grandTotal, keys, marks }: MatrixFootProps) {
  return (
    <tfoot>
      <tr>
        <th className={`${FOOT_LEFT} sticky`} scope="row">
          {m.team_row_total()}
        </th>
        {columnTotals.map((total, index) => (
          <td
            className={`${FOOT} tabular relative text-center ${dividerFor(keys[index] ?? '', marks, index === columnTotals.length - 1)}`}
            key={keys[index] ?? String(index)}
          >
            {complete ? <Figure hours={total.hours} /> : <Reserved />}
          </td>
        ))}
        <th className={`${FOOT_RIGHT} sticky`} scope="row">
          {complete ? (
            <span className="tabular">
              <HourFigure
                className=""
                hours={grandTotal.hours}
                unitClassName="ml-0.5 text-[10px] font-normal text-muted-foreground"
              />
            </span>
          ) : (
            <Reserved />
          )}
        </th>
      </tr>
    </tfoot>
  )
}

/** A column total of nothing is left blank: a zero would be a claim. */
function Figure({ hours }: { readonly hours: number }) {
  if (hours === 0) {
    return null
  }

  return <HourFigure className="" hours={hours} unitClassName="hidden" />
}

function Reserved() {
  return (
    <span aria-hidden className="mx-auto block h-3 w-8 animate-pulse rounded-sm bg-chart-empty" />
  )
}
