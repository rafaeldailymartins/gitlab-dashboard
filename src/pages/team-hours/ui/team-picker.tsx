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
 * It is drawn for a reader who keeps no teams too, saying so, rather than not
 * being drawn at all. Removing it left a gap in the row where a control had
 * been, which reads as something that failed to load rather than as a list with
 * nothing in it — and the one state where a reader most needs to understand what
 * this control is for is the one where it was missing. The row it offers is
 * disabled: it is the answer, not a choice.
 */
export function TeamPicker({ chosen, onChoose, teams }: TeamPickerProps) {
  const empty = teams.length === 0

  return (
    <Select
      items={teams.map((team) => ({ label: team.name, value: team.id }))}
      onValueChange={(id: null | string) => {
        // Null is Base UI clearing the value, which this select cannot do: it
        // has no empty entry a reader can reach.
        if (id !== null) {
          onChoose(id)
        }
      }}
      value={chosen}
    >
      <SelectTrigger aria-label={m.team_picker_label()} className={cn(POPUP_FIELD)}>
        {empty ? (
          <span className="truncate text-muted-foreground">{m.team_picker_empty()}</span>
        ) : (
          <SelectValue />
        )}
      </SelectTrigger>
      <SelectContent>
        {empty ? (
          // A row rather than a bare paragraph: a `listbox` owes ARIA at least
          // one `option`, and `aria-required-children` is a rule this suite
          // runs. Its value is null, which `chosen` — an empty string before a
          // team is picked — never equals, so it draws no chosen mark.
          <SelectItem disabled value={null}>
            {m.team_picker_empty()}
          </SelectItem>
        ) : (
          teams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}
