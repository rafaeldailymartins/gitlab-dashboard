import { lazy, type ReactNode, Suspense, useMemo, useState } from 'react'

import type { GroupRef } from '@/entities/team-timelogs'

import { REFERENCE_SCHEDULE } from '@/entities/team-timelogs'
import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { SyncControl } from '@/widgets/hours-report'

import type { TeamSearch } from '../lib/search-params'

import { chosenTeam, teamOf } from '../lib/chosen-team'
import { legendShows } from '../lib/legend'
import { type ScreenState, screenStateOf } from '../lib/state'
import { useSavedTeams } from '../lib/use-saved-teams'
import { type TeamHoursReport, useTeamReport } from '../lib/use-team-report'
import { MatrixLegend } from './matrix-legend'
import { ReportControls } from './report-controls'
import { TeamMatrix } from './team-matrix'
import { TeamPicker } from './team-picker'

/**
 * The group filter arrives on its own.
 *
 * It is the only thing on this screen that opens a floating popup, and the
 * positioning machinery behind one is forty kilobytes — a sixth of the whole
 * initial load, for a control most readers never touch. Loaded here it lands in
 * a chunk of its own, fetched as this screen mounts, which is the same reasoning
 * `app/lib/runtime.ts` gives for handing out the client instead of this screen's
 * gateway.
 *
 * The teams dialog arrives the same way and for a stronger reason: it carries a
 * whole editing surface, a group list and a person search, none of which a
 * reader reading a month has asked for.
 *
 * Mapped to `default` rather than exported as one: `no-restricted-exports`
 * holds every module here, and a default export would be the one exception.
 */
const GroupFilter = lazy(async () =>
  import('./group-filter').then((module) => ({ default: module.GroupFilter })),
)

const TeamManagerDialog = lazy(async () =>
  import('@/widgets/team-manager').then((module) => ({ default: module.TeamManagerDialog })),
)

/** The sync control carries no caveats on this screen. See where it is used. */
const NO_NOTICES: readonly string[] = []

/** A working day of the stated reference, for the legend. Monday is one. */
const REFERENCE_DAY = REFERENCE_SCHEDULE[1]

interface BodyProps {
  readonly onManage: () => void
  readonly report: TeamHoursReport
  readonly search: TeamSearch
  readonly teamName: string
}

interface TeamHoursPageProps {
  readonly onChange: (search: Partial<TeamSearch>) => void
  readonly search: TeamSearch
}

/**
 * A team's month, per person and per day.
 *
 * Wider than the other screens on purpose: a month of day columns is over a
 * thousand pixels, and it scrolls inside its own bounds rather than taking the
 * page sideways with it.
 *
 * The teams the figures are about are edited over this screen rather than
 * somewhere else. A reader notices a team is wrong while reading its month, and
 * that list has no address worth sending anybody, so leaving here to fix it cost
 * a page load and bought nothing. The dialog is mounted only once it has been
 * asked for, so a reader who never opens it never downloads it.
 */
export function TeamHoursPage({ onChange, search }: TeamHoursPageProps) {
  const saved = useSavedTeams()
  const [managing, setManaging] = useState(false)
  const choice = useMemo(() => chosenTeam(saved.teams, search.team), [saved.teams, search.team])
  const report = useTeamReport(search, teamOf(choice))
  const state = screenStateOf({ choice, report, saved })
  const manage = () => {
    setManaging(true)
  }

  return (
    <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-4 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex flex-col gap-1">
          {/* The screen is named, not the team. The team is named twice below —
              in the picker that chose it and in the table's caption — and a
              heading that changed with the choice made the one fixed landmark
              on the page move under a reader navigating by headings. */}
          <h1 className="text-2xl font-semibold tracking-tight">{m.team_heading()}</h1>
          <p className="text-sm text-muted-foreground">{scopeSentence(report.scope)}</p>
        </div>
        {/* No notices. This control says when the hours arrived, whether they
            are arriving now, and whether asking failed — nothing about what the
            figures could not include. A caveat about a person's hours belongs on
            that person's row, where the figure it qualifies is. */}
        <SyncControl notices={NO_NOTICES} status={report} />
      </header>

      {/* One row of controls that are the same height and bordered the same way,
          so the table starts as high on the page as it can: this screen is read
          by scanning down a team, and every line above the first row is a person
          the reader has to scroll to find. */}
      <div className="flex flex-wrap items-center gap-2">
        <TeamPicker
          chosen={teamOf(choice)?.id ?? ''}
          onChoose={(team) => {
            onChange({ team })
          }}
          onManage={manage}
          teams={saved.teams}
        />
        <Suspense fallback={<Skeleton className="h-9 w-56" />}>
          <GroupFilter
            chosen={filterRef(report.scope, search.group)}
            onChoose={(group) => {
              onChange({ group })
            }}
          />
        </Suspense>
        <ReportControls onChange={onChange} search={search} />
      </div>

      {/* Above the body rather than instead of it: the figures below are the
          reader's whole reach, which is a real report, and the notice says only
          that the narrowing their link asked for was dropped. */}
      {report.scope === 'unreadable' ? <Note>{m.team_unreadable_group()}</Note> : null}

      {BODY[state.kind]({
        onManage: manage,
        report,
        search,
        teamName: teamOf(choice)?.name ?? '',
      })}

      {managing ? (
        <Suspense fallback={null}>
          <TeamManagerDialog onOpenChange={setManaging} open />
        </Suspense>
      ) : null}
    </main>
  )
}

const BODY: Record<ScreenState['kind'], (props: BodyProps) => ReactNode> = {
  'empty-team': (props) => <Note action={props.onManage}>{m.team_empty_team()}</Note>,
  loading: () => <Skeleton className="h-96 w-full" />,
  'no-teams': (props) => <Note action={props.onManage}>{m.team_none_yet()}</Note>,
  reconnect: () => <Note>{m.team_reconnect()}</Note>,
  report: (props) => <Report {...props} />,
  'teams-unavailable': () => <Note>{m.team_store_unavailable()}</Note>,
  'unknown-team': (props) => <Note action={props.onManage}>{m.team_unknown_team()}</Note>,
}

/**
 * The filter as the picker shows it.
 *
 * A group the provider would not resolve still shows the path the address named,
 * so the reader can see what their link asked for rather than a control that
 * silently reset itself.
 */
function filterRef(scope: TeamHoursReport['scope'], fullPath: string): GroupRef | null {
  if (fullPath === '') {
    return null
  }

  return scope === 'unreadable' || scope === null ? { fullPath, id: '', name: fullPath } : scope
}

/** A group that resolved is the only narrowing there is. */
function narrowed(scope: TeamHoursReport['scope']): boolean {
  return scope !== null && scope !== 'unreadable'
}

/**
 * A sentence in place of the table, and the way out of it when there is one.
 *
 * Three of these are about the reader's teams — none kept, one empty, one the
 * address names and they do not have — and every one of them is fixed in the
 * same dialog. A note that states a problem the reader can solve and does not
 * offer the control that solves it makes them go looking for it.
 */
function Note({
  action,
  children,
}: {
  readonly action?: () => void
  readonly children: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card px-4 py-10 text-center">
      <p className="max-w-prose text-sm text-muted-foreground">{children}</p>
      {action === undefined ? null : (
        <Button onClick={action} size="lg" type="button">
          {m.team_manage_link()}
        </Button>
      )}
    </div>
  )
}

/** The table and the key to it, which is read off the table rather than fixed. */
function Report({ report, search, teamName }: BodyProps) {
  const shows = useMemo(() => legendShows(report.grid), [report.grid])

  return (
    <>
      <TeamMatrix
        granularity={search.by}
        month={report.month}
        report={report}
        scope={report.scope}
        teamName={teamName}
        today={report.today}
      />
      <MatrixLegend reference={REFERENCE_DAY} scoped={narrowed(report.scope)} shows={shows} />
    </>
  )
}

/**
 * What the figures cover, in two states rather than one with a blank in it.
 *
 * Unnarrowed, every hour the provider will show this reader is in the answer,
 * personal projects included — the strongest claim this screen has ever made.
 * Narrowed, it covers one group and its descendants and nothing else. Two
 * sentences rather than one with a parameter, because an empty parameter renders
 * as a sentence with a hole in it.
 */
function scopeSentence(scope: TeamHoursReport['scope']): string {
  if (scope === null || scope === 'unreadable') {
    return m.team_scope_everywhere()
  }

  return m.team_scope_group({ group: scope.name })
}
