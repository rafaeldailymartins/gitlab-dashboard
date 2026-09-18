import { Plus } from 'lucide-react'

import type { SuggestedMember } from '@/entities/team-timelogs'
import type { TeamMember } from '@/entities/teams'
import type { IsoDate } from '@/shared/lib/date'

import { m, useActiveLocale } from '@/shared/i18n'
import { formatLongDate } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

import type { Suggestions } from '../lib/use-suggestions'

interface SuggestionListProps {
  /** Identifiers already on the team, so somebody is never offered twice. */
  readonly already: ReadonlySet<string>
  readonly onAdd: (member: TeamMember) => void
  readonly suggestions: Suggestions
}

/**
 * Whoever logged time in the chosen group, offered as candidates.
 *
 * The window is stated rather than assumed. A list of names with no window
 * behind it reads as the group's membership, which it deliberately is not — and
 * somebody who was away for the whole window is missing from it for a reason the
 * reader can only act on if they know the reason.
 *
 * An account that is no longer active is kept and marked: they logged the time,
 * so the work is theirs, and a manager reading last quarter needs them.
 */
export function SuggestionList({ already, onAdd, suggestions }: SuggestionListProps) {
  const { locale } = useActiveLocale()
  const offered = suggestions.people.filter((one) => !already.has(one.person.id))

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {m.teams_suggestions_window({ since: sinceLabel(suggestions.since, locale) })}
      </p>
      {suggestions.partial ? (
        <p className="text-xs text-muted-foreground">{m.teams_suggestions_partial()}</p>
      ) : null}
      {suggestions.loading ? <Skeleton className="h-24 w-full" /> : null}
      {!suggestions.loading && offered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{m.teams_suggestions_none()}</p>
      ) : null}
      <ul className="flex flex-col divide-y divide-border">
        {offered.map((one) => (
          <li className="flex items-center gap-3 py-2" key={one.person.id}>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{one.person.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                @{one.person.username}
                {one.active ? '' : ` · ${m.teams_suggestion_inactive()}`}
              </span>
            </span>
            <Button
              aria-label={m.teams_add_member({ name: one.person.name })}
              className="ml-auto"
              onClick={() => {
                onAdd(memberOf(one))
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

/**
 * A candidate, as the team stores one.
 *
 * `webUrl` is dropped: it is derivable from the username and the instance, and
 * storing it would put a second source of truth for the host in the document.
 */
function memberOf(candidate: SuggestedMember): TeamMember {
  return {
    id: candidate.person.id,
    name: candidate.person.name,
    username: candidate.person.username,
  }
}

function sinceLabel(since: IsoDate, locale: string): string {
  return formatLongDate(since, locale)
}
