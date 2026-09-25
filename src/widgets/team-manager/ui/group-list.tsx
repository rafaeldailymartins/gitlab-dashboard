import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Loader2 } from 'lucide-react'
import { useState } from 'react'

import type { GroupRef } from '@/entities/team-timelogs'

import { groupSearchQuery, useTeamTimelogGateway } from '@/entities/team-timelogs'
import { m } from '@/shared/i18n'
import { SEARCH_SETTLE_MS, useDebounced } from '@/shared/lib/use-debounced'
import { SearchField } from '@/shared/ui/search-field'
import { Skeleton } from '@/shared/ui/skeleton'

interface GroupListProps {
  /** The group currently being read, so its row can say so. */
  readonly busy: null | string
  readonly label: string
  readonly onChoose: (group: GroupRef) => void
}

const ROW =
  'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60'

/**
 * The groups the reader may open, as a list they act on.
 *
 * A list rather than the combobox this used to be, and the difference is what
 * the control means. A combobox asks for a value and keeps it; these rows are
 * each a *verb* — choosing one reads the group and builds a team out of it, and
 * nothing is left selected afterwards. Wearing the clothes of a filter is what
 * made the old surface ask the reader to answer twice: once by naming the squad,
 * then again by clicking a plus beside each of its people.
 *
 * It also costs nothing to draw. The combobox brought a floating popup and its
 * positioning machinery — forty kilobytes — and a popup inside a dialog is a
 * layer over a layer.
 *
 * Filtering is the provider's, not this list's. The search reaches every group
 * the reader is authorized in, which is broader than a page of memberships, and
 * it matches on the path as well as the name: a lead who types `taxplus` gets
 * the squads under it, whose own names contain no such word.
 *
 * **The provider is asked about what the reader stopped typing.** The field
 * holds the raw value so it never lags the keyboard; the query reads the
 * settled one. Undebounced, `taxplus` was six searches of every group this
 * reader can open.
 *
 * Below two characters the term is `null` — the unfiltered list — rather than
 * a disabled query. It is the same key as an empty box, so the two share one
 * answer and one request, and a reader who has typed a single letter is shown
 * every group instead of nothing. Disabling it there did the opposite: the list
 * emptied on the first keystroke and filled again on the second.
 */
export function GroupList({ busy, label, onChoose }: GroupListProps) {
  const gateway = useTeamTimelogGateway()
  const [typed, setTyped] = useState('')
  const search = useDebounced(typed, SEARCH_SETTLE_MS)
  const results = useQuery(groupSearchQuery(gateway, search.length < 2 ? null : search))
  const groups = results.data ?? []

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <SearchField
        label={label}
        onChange={setTyped}
        placeholder={m.teams_group_search_placeholder()}
        value={typed}
      />

      {results.isPending ? <Skeleton className="h-24 w-full" /> : null}

      {!results.isPending && groups.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">{m.team_group_none()}</p>
      ) : (
        <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {groups.map((group) => (
            <li key={group.fullPath}>
              <button
                className={ROW}
                disabled={busy !== null}
                onClick={() => {
                  onChoose(group)
                }}
                type="button"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{group.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{group.fullPath}</span>
                </span>
                <Mark spinning={busy === group.fullPath} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** What the row's right edge shows: that it can be pressed, or that it was. */
function Mark({ spinning }: { readonly spinning: boolean }) {
  if (spinning) {
    return <Loader2 aria-hidden className="ml-auto size-4 shrink-0 animate-spin" />
  }

  return <ChevronRight aria-hidden className="ml-auto size-4 shrink-0 text-muted-foreground" />
}
