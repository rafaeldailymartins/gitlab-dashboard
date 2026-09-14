import { lazy, type ReactNode, Suspense, useMemo } from 'react'

import type { GroupRef } from '@/entities/group-timelogs'

import { REFERENCE_SCHEDULE } from '@/entities/group-timelogs'
import { m } from '@/shared/i18n'
import { Skeleton } from '@/shared/ui/skeleton'
import { SyncControl } from '@/widgets/hours-report'

import type { TeamSearch } from '../lib/search-params'

import { legendShows } from '../lib/legend'
import { type ScreenState, screenStateOf } from '../lib/state'
import { useTeamReport } from '../lib/use-team-report'
import { MatrixLegend } from './matrix-legend'
import { ReportControls } from './report-controls'
import { TeamMatrix } from './team-matrix'

/**
 * The picker arrives on its own.
 *
 * It is the only thing in this app that opens a floating popup, and the
 * positioning machinery behind one is forty kilobytes — a sixth of the whole
 * initial load, for a control on a screen most readers never open. Loaded here
 * it lands in a chunk of its own, fetched as this screen mounts, which is the
 * same reasoning `app/lib/runtime.ts` gives for handing out the client instead
 * of this screen's gateway.
 *
 * Mapped to `default` rather than exported as one: `no-restricted-exports`
 * holds every module here, and a default export would be the one exception.
 */
const GroupPicker = lazy(async () =>
  import('./group-picker').then((module) => ({ default: module.GroupPicker })),
)

/** The sync control carries no caveats on this screen. See where it is used. */
const NO_NOTICES: readonly string[] = []

/** A working day of the stated reference, for the legend. Monday is one. */
const REFERENCE_DAY = REFERENCE_SCHEDULE[1]

interface BodyProps {
  readonly report: ReturnType<typeof useTeamReport>
  readonly search: TeamSearch
}

interface TeamHoursPageProps {
  readonly onChange: (search: Partial<TeamSearch>) => void
  readonly search: TeamSearch
}

/**
 * A group's month, per person and per day.
 *
 * Wider than the other screens on purpose: a month of day columns is over a
 * thousand pixels, and it scrolls inside its own bounds rather than taking the
 * page sideways with it.
 */
export function TeamHoursPage({ onChange, search }: TeamHoursPageProps) {
  const report = useTeamReport(search)
  const state = screenStateOf({ group: search.group, report })

  return (
    <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-4 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {report.group?.name ?? m.team_title()}
          </h1>
          <p className="text-sm text-muted-foreground">{m.team_scope()}</p>
        </div>
        {/* No notices. This control says when the hours arrived, whether they
            are arriving now, and whether asking failed — nothing about what the
            figures could not include. A caveat about a person's hours belongs on
            that person's row, where the figure it qualifies is. */}
        <SyncControl notices={NO_NOTICES} status={report} />
      </header>

      {/* One row, so the table starts as high on the page as it can: this screen
          is read by scanning down a group, and every line above the first row is
          a person the reader has to scroll to find. */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <Suspense fallback={<Skeleton className="h-14 w-full max-w-sm" />}>
          <GroupPicker
            chosen={groupRef(report.group, search.group)}
            onChoose={(group) => {
              onChange({ group })
            }}
          />
        </Suspense>
        <ReportControls onChange={onChange} search={search} />
      </div>

      {BODY[state.kind]({ report, search })}
    </main>
  )
}

const BODY: Record<ScreenState['kind'], (props: BodyProps) => ReactNode> = {
  'choose-group': () => <Note>{m.team_choose_group()}</Note>,
  empty: () => <Note>{m.team_empty_group()}</Note>,
  loading: () => <Skeleton className="h-96 w-full" />,
  report: ({ report, search }) => <Report report={report} search={search} />,
  'unreadable-group': () => <Note>{m.team_unreadable_group()}</Note>,
}

/** The chosen group as a picker shows it, falling back to the path it was given. */
function groupRef(group: GroupRef | null, fullPath: string): GroupRef | null {
  if (fullPath === '') {
    return null
  }

  return group ?? { fullPath, name: fullPath }
}

function Note({ children }: { readonly children: ReactNode }) {
  return (
    <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

/** The table and the key to it, which is read off the table rather than fixed. */
function Report({ report, search }: BodyProps) {
  const shows = useMemo(() => legendShows(report.grid), [report.grid])

  return (
    <>
      <TeamMatrix
        granularity={search.by}
        groupName={report.group?.name ?? search.group}
        month={report.month}
        report={report}
        today={report.today}
      />
      <MatrixLegend reference={REFERENCE_DAY} shows={shows} />
    </>
  )
}
