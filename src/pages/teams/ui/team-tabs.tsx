import type { Team } from '@/entities/teams'

import { m } from '@/shared/i18n'

const TAB =
  'rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:bg-primary aria-pressed:font-medium aria-pressed:text-primary-foreground'

interface TeamTabsProps {
  readonly chosen: null | Team
  readonly onChoose: (id: string) => void
  readonly teams: readonly Team[]
}

/**
 * Which team is being edited.
 *
 * Toggle buttons in a named group rather than a tablist. A real tablist owes the
 * reader arrow-key navigation and a `tabpanel` per tab, and what is below here
 * is one editor that changes its contents — the panel never changes identity, so
 * the pattern would be a promise the markup does not keep.
 */
export function TeamTabs({ chosen, onChoose, teams }: TeamTabsProps) {
  if (teams.length === 0) {
    return null
  }

  return (
    <div aria-label={m.teams_list_heading()} className="flex flex-wrap gap-2" role="group">
      {teams.map((team) => (
        <button
          aria-pressed={team.id === chosen?.id}
          className={TAB}
          key={team.id}
          onClick={() => {
            onChoose(team.id)
          }}
          type="button"
        >
          {team.name}
        </button>
      ))}
    </div>
  )
}
