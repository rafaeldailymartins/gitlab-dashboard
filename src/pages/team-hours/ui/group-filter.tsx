import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import type { GroupRef } from '@/entities/team-timelogs'

import { groupSearchQuery, useTeamTimelogGateway } from '@/entities/team-timelogs'
import { m } from '@/shared/i18n'
import { cn } from '@/shared/lib/utils'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/shared/ui/combobox'
import { POPUP_FIELD } from '@/shared/ui/popup'

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

interface GroupFilterProps {
  /** The group this filter holds, or null when the report is unnarrowed. */
  readonly chosen: GroupRef | null
  /** The chosen path, or an empty one when the reader cleared it. */
  readonly onChoose: (fullPath: string) => void
}

/**
 * How much of the team's work counts, narrowed to one group or not narrowed.
 *
 * This lived in `features/` while two screens needed a group control. The teams
 * surface no longer does — a group there is an action that builds a team, drawn
 * as a list of rows to press, not a value to hold — so a shared component would
 * now be one consumer paying for another's abstraction, which is what steiger's
 * insignificant-slice rule exists to stop. The labels went back to being
 * literals in messages rather than props for the same reason.
 *
 * Named by `aria-label` rather than by a label above it. The visible label made
 * this control two lines tall in a row of one-line controls, which is what left
 * the toolbar looking ragged — and it restated what the field's own value says.
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
export function GroupFilter({ chosen, onChoose }: GroupFilterProps) {
  const gateway = useTeamTimelogGateway()
  const [typed, setTyped] = useState('')
  const results = useQuery({
    ...groupSearchQuery(gateway, typed === '' ? null : typed),
    // One letter matches most of an instance; the reader is still typing.
    enabled: typed.length !== 1,
  })
  const groups = [{ ...NOTHING, name: m.team_filter_all() }, ...(results.data ?? [])]

  return (
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
      <ComboboxInput
        aria-label={m.team_filter_label()}
        className={cn(POPUP_FIELD)}
        placeholder={m.team_filter_all()}
      />
      <ComboboxContent>
        <ComboboxEmpty>{m.team_group_none()}</ComboboxEmpty>
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
  )
}
