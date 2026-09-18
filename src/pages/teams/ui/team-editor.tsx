import { lazy, Suspense, useId } from 'react'

import type { Team } from '@/entities/teams'

import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

import type { TeamActions } from '../lib/team-actions'
import type { Suggestions } from '../lib/use-suggestions'

import { MemberList } from './member-list'
import { PersonSearch } from './person-search'
import { TeamNameField } from './team-name-field'

/** The group picker opens a floating popup; see the report screen for the cost. */
const GroupPicker = lazy(async () =>
  import('@/features/group-picker').then((module) => ({ default: module.GroupPicker })),
)

const SuggestionList = lazy(async () =>
  import('./suggestion-list').then((module) => ({ default: module.SuggestionList })),
)

interface TeamEditorProps extends TeamActions {
  /** Identifiers already on the team, so nobody is offered twice. */
  readonly already: ReadonlySet<string>
  readonly onSeed: (fullPath: string) => void
  readonly seedGroup: string
  readonly suggestions: Suggestions
  readonly team: Team
}

/**
 * One team: its name, its people, and the two ways to add somebody.
 *
 * Two ways rather than one, and neither is redundant. The group offers the
 * people who actually logged time there, which is the fast path and the one a
 * lead reaches for; the search finds anybody at all, which is the only way to
 * add somebody who has logged nothing yet — a new joiner, most often.
 */
export function TeamEditor({
  already,
  onAdd,
  onDelete,
  onRemove,
  onRename,
  onSeed,
  seedGroup,
  suggestions,
  team,
}: TeamEditorProps) {
  const peopleId = useId()
  const suggestionsId = useId()
  const searchId = useId()

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={peopleId} className="flex flex-col gap-3">
        <h2 className="text-lg font-medium" id={peopleId}>
          {m.teams_members_heading()}
        </h2>
        <TeamNameField onRename={onRename} team={team} />
        <MemberList onRemove={onRemove} team={team} />
        <Button className="self-start" onClick={onDelete} type="button" variant="outline">
          {m.teams_delete_team()}
        </Button>
      </section>

      <section aria-labelledby={suggestionsId} className="flex flex-col gap-3">
        <h2 className="text-lg font-medium" id={suggestionsId}>
          {m.teams_suggestions_heading()}
        </h2>
        <p className="text-sm text-muted-foreground">{m.teams_suggestions_description()}</p>
        <Suspense fallback={<Skeleton className="h-14 w-full max-w-sm" />}>
          <GroupPicker
            chosen={seedGroup === '' ? null : { fullPath: seedGroup, id: '', name: seedGroup }}
            labels={{
              empty: m.team_group_none(),
              label: m.teams_seed_label(),
              placeholder: m.teams_seed_placeholder(),
            }}
            onChoose={onSeed}
          />
        </Suspense>
        {seedGroup === '' ? null : (
          <Suspense fallback={<Skeleton className="h-24 w-full" />}>
            <SuggestionList already={already} onAdd={onAdd} suggestions={suggestions} />
          </Suspense>
        )}
      </section>

      <section aria-labelledby={searchId} className="flex flex-col gap-3">
        <h2 className="text-lg font-medium" id={searchId}>
          {m.teams_search_heading()}
        </h2>
        <PersonSearch already={already} onAdd={onAdd} />
      </section>
    </div>
  )
}
