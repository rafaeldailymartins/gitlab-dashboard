import { X } from 'lucide-react'

import type { Team, TeamMember } from '@/entities/teams'

import { orderedMembers } from '@/entities/teams'
import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'

interface MemberListProps {
  readonly onRemove: (member: TeamMember) => void
  readonly team: Team
}

/**
 * Who is on the team.
 *
 * A list rather than a table: there are three facts about each person and one
 * action, and a table of that would be columns of white space. It is ordered by
 * name, the same order the report's rows open in, so the two screens agree about
 * what "this team" looks like.
 */
export function MemberList({ onRemove, team }: MemberListProps) {
  const members = orderedMembers(team)

  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">{m.teams_no_members()}</p>
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {members.map((member) => (
        <li className="flex items-center gap-3 py-2" key={member.id}>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{member.name}</span>
            <span className="truncate text-xs text-muted-foreground">@{member.username}</span>
          </span>
          <Button
            aria-label={m.teams_remove_member({ name: member.name })}
            className="ml-auto"
            onClick={() => {
              onRemove(member)
            }}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  )
}
