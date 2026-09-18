import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'

import type { GroupRef } from '@/entities/team-timelogs'

import { groupSearchQuery, useTeamTimelogGateway } from '@/entities/team-timelogs'
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

/**
 * The entry that clears the choice.
 *
 * A group with an empty path, which is exactly what "no group" is everywhere
 * else in this app — so clearing takes the same route as choosing and the caller
 * has one case, not two.
 */
const NOTHING: GroupRef = { fullPath: '', id: '', name: '' }

/** Every string this picker shows. Passed in, because the two uses ask different questions. */
export interface GroupPickerLabels {
  /** What the picker offers to mean "no group at all". Absent makes it unclearable. */
  readonly clear?: string
  readonly empty: string
  readonly label: string
  readonly placeholder: string
}

interface GroupPickerProps {
  /** The group this picker holds, or null when none is chosen. */
  readonly chosen: GroupRef | null
  readonly labels: GroupPickerLabels
  /** The chosen path, or an empty one when the reader cleared it. */
  readonly onChoose: (fullPath: string) => void
}

/**
 * A group, chosen from a combobox.
 *
 * A feature rather than a page component because two screens now need one: the
 * report narrows its figures to a group, and the teams screen seeds a team from
 * whoever logged time in one. They ask different questions of the same list, so
 * every string is a prop — and only one of them can be cleared, because only one
 * of them has a meaningful "none".
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
export function GroupPicker({ chosen, labels, onChoose }: GroupPickerProps) {
  const gateway = useTeamTimelogGateway()
  const fieldId = useId()
  const [typed, setTyped] = useState('')
  const results = useQuery({
    ...groupSearchQuery(gateway, typed === '' ? null : typed),
    // One letter matches most of an instance; the reader is still typing.
    enabled: typed.length !== 1,
  })
  const groups = offered(results.data ?? [], labels.clear)

  return (
    <div className="flex w-full max-w-sm flex-col gap-1.5">
      <Label htmlFor={fieldId}>{labels.label}</Label>
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
        <ComboboxInput id={fieldId} placeholder={labels.placeholder} />
        <ComboboxContent>
          <ComboboxEmpty>{labels.empty}</ComboboxEmpty>
          <ComboboxList>
            {(group: GroupRef) => (
              <ComboboxItem key={group.fullPath} value={group}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{group.name}</span>
                  {group.fullPath === '' ? null : (
                    <span className="truncate text-xs text-muted-foreground">{group.fullPath}</span>
                  )}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}

/**
 * The groups on offer, with the clearing entry first when there is one.
 *
 * First because it is the widest answer and the default: a reader looking for
 * the way back to "everything" should not have to scroll a search result to
 * find it.
 */
function offered(groups: readonly GroupRef[], clear: string | undefined): readonly GroupRef[] {
  return clear === undefined ? groups : [{ ...NOTHING, name: clear }, ...groups]
}
