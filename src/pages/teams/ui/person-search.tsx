import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useId, useState } from 'react'

import type { TeamMember } from '@/entities/teams'

import { peopleSearchQuery, useTeamTimelogGateway } from '@/entities/team-timelogs'
import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

interface PersonSearchProps {
  /** Identifiers already on the team, so somebody is never offered twice. */
  readonly already: ReadonlySet<string>
  readonly onAdd: (member: TeamMember) => void
}

/**
 * Anybody, by name or handle.
 *
 * The escape hatch the suggestions need. A ninety-day window read to a cap will
 * miss somebody — a new joiner, somebody back from leave, somebody who logs
 * their time in a group the reader did not pick — and every one of those is a
 * person the reader knows the name of. This finds them without them having
 * logged anything anywhere.
 */
export function PersonSearch({ already, onAdd }: PersonSearchProps) {
  const gateway = useTeamTimelogGateway()
  const fieldId = useId()
  const [typed, setTyped] = useState('')
  const results = useQuery({
    ...peopleSearchQuery(gateway, typed),
    // One letter matches most of an instance; the reader is still typing.
    enabled: typed.trim().length > 1,
  })
  const found = (results.data ?? []).filter((person) => !already.has(person.id))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId}>{m.teams_search_label()}</Label>
        <Input
          id={fieldId}
          onChange={(event) => {
            setTyped(event.target.value)
          }}
          placeholder={m.teams_search_placeholder()}
          type="search"
          value={typed}
        />
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {found.map((person) => (
          <li className="flex items-center gap-3 py-2" key={person.id}>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{person.name}</span>
              <span className="truncate text-xs text-muted-foreground">@{person.username}</span>
            </span>
            <Button
              aria-label={m.teams_add_member({ name: person.name })}
              className="ml-auto"
              onClick={() => {
                onAdd({ id: person.id, name: person.name, username: person.username })
              }}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Plus aria-hidden className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
