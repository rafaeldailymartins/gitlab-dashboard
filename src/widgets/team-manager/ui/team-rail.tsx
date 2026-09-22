import { Plus } from 'lucide-react'
import { useId } from 'react'

import type { Team } from '@/entities/teams'

import { MAX_TEAMS } from '@/entities/teams'
import { m } from '@/shared/i18n'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'

interface TeamRailProps {
  readonly chosen: null | Team
  readonly onChoose: (id: string) => void
  readonly onStart: () => void
  readonly teams: readonly Team[]
}

const ROW =
  'flex w-full items-baseline gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'

/**
 * Which team is being edited, and the way to start another.
 *
 * Toggle buttons in a named group rather than a tablist. A real tablist owes the
 * reader arrow-key navigation and a `tabpanel` per tab, and what is beside this
 * is one pane that changes its contents — the panel never changes identity, so
 * the pattern would be a promise the markup does not keep.
 *
 * A rail rather than a wrapping row of chips: the count is what the reader scans
 * and a vertical list reads as a list of teams, where chips read as filters. It
 * folds above the pane at 375 px, where a rail would be a column of one word.
 *
 * Adding is refused at the ceiling rather than left to fail on the save, so a
 * reader learns the limit before spending a round trip on it.
 */
export function TeamRail({ chosen, onChoose, onStart, teams }: TeamRailProps) {
  const headingId = useId()

  return (
    <section
      aria-labelledby={headingId}
      className="flex shrink-0 flex-col gap-1 border-b border-border p-3 sm:w-56 sm:border-r sm:border-b-0"
    >
      <h2
        className="px-2.5 pt-1 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
        id={headingId}
      >
        {m.teams_list_heading()}
      </h2>

      {/* Rendered only when there is something in it. An empty named group is a
          list the surface cannot vouch for wearing the clothes of one it can. */}
      {teams.length === 0 ? null : (
        <div
          aria-label={m.teams_list_heading()}
          className="flex max-h-40 flex-col gap-0.5 overflow-y-auto sm:max-h-none"
          role="group"
        >
          {teams.map((team) => (
            <button
              aria-pressed={team.id === chosen?.id}
              className={cn(ROW, 'aria-pressed:bg-accent aria-pressed:font-medium')}
              key={team.id}
              onClick={() => {
                onChoose(team.id)
              }}
              type="button"
            >
              <span className="truncate">{team.name}</span>
              <span className="tabular ml-auto shrink-0 text-xs text-muted-foreground">
                {team.members.length}
              </span>
            </button>
          ))}
        </div>
      )}

      <Button
        className="mt-1 justify-start"
        disabled={teams.length >= MAX_TEAMS}
        onClick={onStart}
        size="lg"
        type="button"
        variant="ghost"
      >
        <Plus aria-hidden />
        {m.teams_add_team()}
      </Button>
    </section>
  )
}
