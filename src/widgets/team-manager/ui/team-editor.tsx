import { Trash2, UsersRound } from 'lucide-react'
import { useId } from 'react'

import type { Team } from '@/entities/teams'

import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'

import type { TeamActions } from '../lib/team-actions'

import { MemberList } from './member-list'
import { PersonSearch } from './person-search'
import { TeamNameField } from './team-name-field'

interface TeamEditorProps extends TeamActions {
  /** Identifiers already on the team, so nobody is offered twice. */
  readonly already: ReadonlySet<string>
  readonly onAddFromGroup: () => void
  readonly team: Team
}

/**
 * One team: its name, its people, and the two ways to change who is on it.
 *
 * Neither way is redundant, and only one of them is a control that lives here.
 * The search finds anybody at all, logged or not, and is how a team is
 * corrected — so it is a field, always open. A group is a whole squad at once,
 * which is a decision rather than a correction, so it is a button that opens the
 * list and closes again. The combobox that used to sit here permanently was the
 * wrong shape for both.
 *
 * Deleting is an icon at the edge of the name it acts on, not a button under the
 * list. As a full-width outline button beside "New team" it had the weight of a
 * thing the reader was meant to do.
 */
export function TeamEditor({
  already,
  onAdd,
  onAddFromGroup,
  onDelete,
  onRemove,
  onRename,
  team,
}: TeamEditorProps) {
  const peopleId = useId()

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-end gap-3 border-b border-border p-5">
        <TeamNameField onRename={onRename} team={team} />
        <Button
          aria-label={m.teams_delete_team()}
          className="ml-auto text-muted-foreground"
          onClick={onDelete}
          size="icon-lg"
          type="button"
          variant="ghost"
        >
          <Trash2 aria-hidden />
        </Button>
      </div>

      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
        <section aria-labelledby={peopleId} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold" id={peopleId}>
              {m.teams_members_heading()}
            </h2>
            <Button onClick={onAddFromGroup} size="sm" type="button" variant="outline">
              <UsersRound aria-hidden />
              {m.teams_add_from_group()}
            </Button>
          </div>
          <MemberList onRemove={onRemove} team={team} />
        </section>

        <PersonSearch already={already} onAdd={onAdd} />
      </div>
    </div>
  )
}
