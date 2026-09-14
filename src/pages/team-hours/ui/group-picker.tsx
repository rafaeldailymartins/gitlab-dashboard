import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'

import type { GroupRef } from '@/entities/group-timelogs'

import { groupSearchQuery, useGroupTimelogGateway } from '@/entities/group-timelogs'
import { m } from '@/shared/i18n'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/shared/ui/combobox'
import { Label } from '@/shared/ui/label'

/** The reason Base UI reports when the reader typed, rather than when it wrote. */
const TYPED = 'input-change'

interface GroupPickerProps {
  /** The group this picker holds, or null when none is chosen. */
  readonly chosen: GroupRef | null
  readonly onChoose: (fullPath: string) => void
}

/**
 * The group, chosen from a combobox.
 *
 * Filtering is the provider's, not the combobox's — `filter={null}`. The search
 * reaches every group the reader is authorized in, which is broader than a page
 * of memberships, and it matches on the path as well as the name: a lead who
 * types `taxplus` gets the squads under it, whose own names contain no such
 * word. Re-filtering those results by name here would hide exactly the answers
 * the wider search was for.
 *
 * The query only follows what the reader typed. Base UI writes the chosen
 * group's name back into the field when the popup closes, and treating that as a
 * search would re-ask the provider for a group already in hand and then reopen
 * the list filtered down to the one item already selected.
 */
export function GroupPicker({ chosen, onChoose }: GroupPickerProps) {
  const gateway = useGroupTimelogGateway()
  const fieldId = useId()
  const [typed, setTyped] = useState('')
  const results = useQuery({
    ...groupSearchQuery(gateway, typed === '' ? null : typed),
    // One letter matches most of an instance; the reader is still typing.
    enabled: typed.length !== 1,
  })
  const groups = results.data ?? []

  return (
    <div className="flex w-full max-w-sm flex-col gap-1.5">
      <Label htmlFor={fieldId}>{m.team_group_label()}</Label>
      <Combobox
        filter={null}
        isItemEqualToValue={(left: GroupRef, right: GroupRef) => left.fullPath === right.fullPath}
        items={groups}
        itemToStringLabel={(group: GroupRef) => group.name}
        onInputValueChange={(value, details) => {
          if (details.reason === TYPED) {
            setTyped(value)
          }
        }}
        onValueChange={(group: GroupRef | null) => {
          if (group !== null) {
            onChoose(group.fullPath)
          }
        }}
        value={chosen}
      >
        <ComboboxInput id={fieldId} placeholder={m.team_group_search()} />
        <ComboboxContent>
          <ComboboxEmpty>{m.team_group_none()}</ComboboxEmpty>
          <ComboboxList>
            {(group: GroupRef) => (
              <ComboboxItem key={group.fullPath} value={group}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{group.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{group.fullPath}</span>
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
