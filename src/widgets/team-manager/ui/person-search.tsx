import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useId, useState } from 'react'

import type { TeamMember } from '@/entities/teams'

import { peopleSearchQuery, useTeamTimelogGateway } from '@/entities/team-timelogs'
import { m } from '@/shared/i18n'
import { SEARCH_SETTLE_MS, useDebounced } from '@/shared/lib/use-debounced'
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
 *
 * **The provider is asked about what the reader stopped typing, not about every
 * keystroke.** The field holds `typed` so it never lags the keyboard; the query
 * reads the settled value. Undebounced, a ten-letter name was nine GraphQL
 * requests — and the app's retry policy makes that up to twenty-seven on a
 * connection that is dropping them. The two characters are a floor and not a
 * substitute: they only stop the first request, and the reason the query is
 * disabled below them is that `users(search: "")` is a page of strangers.
 *
 * `found` is emptied below that floor rather than read off `data`. The query
 * keeps its previous answer as a placeholder so the list does not blink between
 * terms, and a placeholder outlives the `enabled` guard — so trusting `data`
 * would leave a list of people under a box the reader had just cleared.
 */
export function PersonSearch({ already, onAdd }: PersonSearchProps) {
  const gateway = useTeamTimelogGateway()
  const headingId = useId()
  const [typed, setTyped] = useState('')
  const search = useDebounced(typed, SEARCH_SETTLE_MS)
  // One letter matches most of an instance; the reader is still typing.
  const searching = search.trim().length > 1
  const results = useQuery({ ...peopleSearchQuery(gateway, search), enabled: searching })
  const found = searching ? (results.data ?? []).filter((person) => !already.has(person.id)) : []

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
