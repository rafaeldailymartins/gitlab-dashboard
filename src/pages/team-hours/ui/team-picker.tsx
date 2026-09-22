import { UsersRound } from 'lucide-react'

import type { Team } from '@/entities/teams'

import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'

interface TeamPickerProps {
  /** The team the address names, or an empty string before one is chosen. */
  readonly chosen: string
  readonly onChoose: (id: string) => void
  readonly onManage: () => void
  readonly teams: readonly Team[]
}

/**
 * Which team the report is about, with the way to change what a team is
 * attached to it.
 *
 * A native select rather than the searchable combobox the group filter uses.
 * The two look like the same control and are not: a reader has a handful of
 * teams and all of them are already in hand, while the groups are thousands and
 * come from the provider a page at a time. Reaching for the combobox here would
 * spend forty kilobytes of positioning machinery to search three items.
 *
 * The teams button shares this control's border rather than sitting at the end
 * of the row as an underlined link. A control that acts on the thing beside it
 * should be attached to it; among four unrelated controls it read as a fifth
 * filter, and as a text link it read as navigation away from the report — which
 * is exactly what it has stopped being.
 *
 * The select is absent when the reader keeps no teams, and the button is not: an
 * empty select is a control with nothing to choose, while the button is the one
 * thing that reader can do.
 */
export function TeamPicker({ chosen, onChoose, onManage, teams }: TeamPickerProps) {
  return (
    <div className="flex h-9 items-center rounded-lg border border-input">
      {teams.length === 0 ? null : (
        <>
          <select
            aria-label={m.team_picker_label()}
            className="h-full max-w-48 rounded-l-lg bg-transparent px-2.5 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            onChange={(event) => {
              onChoose(event.target.value)
            }}
            value={chosen}
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <span aria-hidden className="h-5 w-px shrink-0 bg-input" />
        </>
      )}
      <Button
        aria-label={m.team_manage_link()}
        className="mx-0.5 text-muted-foreground"
        onClick={onManage}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <UsersRound aria-hidden />
      </Button>
    </div>
  )
}
