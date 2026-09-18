import type { Team } from '@/entities/teams'

import { m } from '@/shared/i18n'
import { SelectField } from '@/shared/ui/select-field'

interface TeamPickerProps {
  /** The team the address names, or an empty string before one is chosen. */
  readonly chosen: string
  readonly onChoose: (id: string) => void
  readonly teams: readonly Team[]
}

/**
 * Which team the report is about.
 *
 * A native select rather than the searchable combobox the group filter uses.
 * The two look like the same control and are not: a reader has a handful of
 * teams and all of them are already in hand, while the groups are thousands and
 * come from the provider a page at a time. Reaching for the combobox here would
 * spend forty kilobytes of positioning machinery to search three items.
 *
 * It is never empty. A reader with no teams does not reach this control — the
 * screen says so instead and offers the way to build one — so there is no
 * placeholder option that would sit in the list forever afterwards.
 */
export function TeamPicker({ chosen, onChoose, teams }: TeamPickerProps) {
  return (
    <SelectField
      label={m.team_picker_label()}
      onChange={onChoose}
      options={teams.map((team) => ({ label: team.name, value: team.id }))}
      value={chosen}
    />
  )
}
