import type { Team } from '@/entities/teams'

import { m } from '@/shared/i18n'
import { cn } from '@/shared/lib/utils'
import { POPUP_FIELD } from '@/shared/ui/popup'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

interface TeamPickerProps {
  /** The team the address names, or an empty string before one is chosen. */
  readonly chosen: string
  readonly onChoose: (id: string) => void
  readonly teams: readonly Team[]
}

/**
 * Which team the report is about.
 *
 * A select rather than the combobox the group filter uses, and the two are still
 * the same control to look at. The distinction is real — a reader has a handful
 * of teams and all of them are already in hand, while the groups are thousands
 * and come from the provider a page at a time — so one is typed at and one is
 * not. Nothing about that distinction is visible, and it should not be: they
 * stand next to each other.
 *
 * This was a native `<select>`, which is the mistake this replaces. It was
 * chosen to avoid spending a floating popup's positioning machinery on three
 * items, and that saving was never real: the group filter on the same row
 * already loads it, so the two shared everything except their appearance. What
 * the reader got instead was one control opening the app's own panel and the
 * one beside it opening the operating system's — a different font, a different
 * width, a different highlight, six pixels apart. Both surfaces now come from
 * `shared/ui/popup.ts`.
 *
 * It is never empty. A reader with no teams does not reach this control — the
 * screen says so instead and offers the way to build one — so there is no
 * placeholder option that would sit in the list forever afterwards.
 */
export function TeamPicker({ chosen, onChoose, teams }: TeamPickerProps) {
  return (
    <Select
      items={teams.map((team) => ({ label: team.name, value: team.id }))}
      onValueChange={(id: null | string) => {
        // Null is Base UI clearing the value, which this select cannot do: it
        // has no empty entry, because a reader with no teams never reaches it.
        if (id !== null) {
          onChoose(id)
        }
      }}
      value={chosen}
    >
      <SelectTrigger aria-label={m.team_picker_label()} className={cn(POPUP_FIELD)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {teams.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            {team.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
