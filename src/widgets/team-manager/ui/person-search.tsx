import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useId, useState } from 'react'

import type { TeamMember } from '@/entities/teams'

import { peopleSearchQuery, useTeamTimelogGateway } from '@/entities/team-timelogs'
import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'
import { SearchField } from '@/shared/ui/search-field'

interface PersonSearchProps {
  /** Identifiers already on the team, so somebody is never offered twice. */
  readonly already: ReadonlySet<string>
  readonly onAdd: (member: TeamMember) => void
}

/**
 * Anybody, by name or handle.
 *
 * The escape hatch a group read to a cap needs. A thirty-day window will miss
 * somebody — a new joiner, somebody back from leave, somebody who logs their
 * time in a group the reader did not name — and every one of those is a person
 * the reader knows the name of. This finds them without them having logged
 * anything anywhere.
 *
 * Its own region, named by a heading nobody sees. The heading would be a label
 * over a labelled field, which is the same word twice; the region is what lets a
 * reader using a screen reader tell "somebody the search found" from "somebody
 * on the team", which are two different claims about the same name.
 */
export function PersonSearch({ already, onAdd }: PersonSearchProps) {
  const gateway = useTeamTimelogGateway()
  const headingId = useId()
  const [typed, setTyped] = useState('')
  const results = useQuery({
    ...peopleSearchQuery(gateway, typed),
    // One letter matches most of an instance; the reader is still typing.
    enabled: typed.trim().length > 1,
  })
  const found = (results.data ?? []).filter((person) => !already.has(person.id))

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 className="sr-only" id={headingId}>
        {m.teams_search_heading()}
      </h2>
      <SearchField
        label={m.teams_search_label()}
        onChange={setTyped}
        placeholder={m.teams_search_placeholder()}
        value={typed}
      />
      {found.length === 0 ? null : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border px-3">
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
                <Plus aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
