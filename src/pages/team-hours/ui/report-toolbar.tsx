import { UsersRound } from 'lucide-react'
import { lazy, Suspense } from 'react'

import type { GroupRef } from '@/entities/team-timelogs'
import type { Team } from '@/entities/teams'

import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'
import { POPUP_FIELD } from '@/shared/ui/popup'
import { Skeleton } from '@/shared/ui/skeleton'

import type { TeamSearch } from '../lib/search-params'

import { ReportControls } from './report-controls'

/**
 * The dialog's module, reachable before it is rendered.
 *
 * Exported so the button that opens it can start fetching while the reader is
 * still moving towards it. Measured on this bundle, served locally: the first
 * open cost **525 ms** and two requests, because the click was the first thing
 * that asked for the chunk — and on a machine six times slower, 2.5 seconds,
 * with an 850 ms task parsing it. Warmed, the same open is 88 ms, which is the
 * animation. Nothing about that was the reader's machine.
 *
 * An idempotent promise by construction: a dynamic import of the same specifier
 * returns the same module record, so calling this on every pointer that crosses
 * the button costs one fetch.
 */
export const loadTeamManager = async () => import('@/widgets/team-manager')

/**
 * Both pickers arrive on their own, and neither is in the bundle every reader
 * downloads.
 *
 * They are the only things on this screen that open a floating popup, and the
 * positioning machinery behind one is forty kilobytes. Imported eagerly it does
 * not merely land in this route's chunk: Base UI's internals are shared with the
 * button and the input every screen already uses, so the bundler hoists the lot
 * into the entry — measured, and it put the initial load 34 kB over its 180 kB
 * budget. Loaded here they land in chunks of their own, fetched as this screen
 * mounts, which is the same reasoning `app/lib/runtime.ts` gives for handing out
 * the client instead of this screen's gateway.
 *
 * Mapped to `default` rather than exported as one: `no-restricted-exports`
 * holds every module here, and a default export would be the one exception.
 */
const GroupFilter = lazy(async () =>
  import('./group-filter').then((module) => ({ default: module.GroupFilter })),
)

const TeamPicker = lazy(async () =>
  import('./team-picker').then((module) => ({ default: module.TeamPicker })),
)

interface ReportToolbarProps {
  /** The group the filter holds, or null when the report is unnarrowed. */
  readonly filter: GroupRef | null
  readonly onChange: (search: Partial<TeamSearch>) => void
  readonly onManage: () => void
  readonly search: TeamSearch
  /** The team the address names, or an empty string before one is chosen. */
  readonly team: string
  readonly teams: readonly Team[]
}

/**
 * Everything the reader can change about what the table shows, in one row.
 *
 * Every control on it is the same height and bordered the same way, so the table
 * starts as high on the page as it can: this screen is read by scanning down a
 * team, and every line above the first row is a person the reader has to scroll
 * to find. It used to be four controls at three different heights, two of them
 * under stacked labels, which is what made the row look ragged.
 *
 * The teams button is pushed to the far end rather than sitting among them. The
 * four on the left all narrow or move what the table shows; this one changes
 * what a team *is*, which is a different kind of thing, and beside a filter it
 * reads as a fifth one.
 */
export function ReportToolbar({
  filter,
  onChange,
  onManage,
  search,
  team,
  teams,
}: ReportToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {teams.length === 0 ? null : (
        <Suspense fallback={<Skeleton className={POPUP_FIELD} />}>
          <TeamPicker
            chosen={team}
            onChoose={(chosen) => {
              onChange({ team: chosen })
            }}
            teams={teams}
          />
        </Suspense>
      )}
      <Suspense fallback={<Skeleton className={POPUP_FIELD} />}>
        <GroupFilter
          chosen={filter}
          onChoose={(group) => {
            onChange({ group })
          }}
        />
      </Suspense>
      <ReportControls onChange={onChange} search={search} />
      {/* The chunk starts arriving when the pointer reaches the button, not when
          it is pressed. Focus does the same, so a reader tabbing to it gets the
          same head start as one reaching for it. */}
      <Button
        className="ms-auto"
        onClick={onManage}
        onFocus={() => {
          void loadTeamManager()
        }}
        onPointerEnter={() => {
          void loadTeamManager()
        }}
        size="lg"
        type="button"
        variant="outline"
      >
        <UsersRound aria-hidden />
        {m.team_manage_link()}
      </Button>
    </div>
  )
}
