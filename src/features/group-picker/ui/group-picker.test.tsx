import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fakeTeamGateway, renderReport, SQUAD } from '~tests/support/report'

import type { GroupRef } from '@/entities/team-timelogs'

import { GroupPicker } from './group-picker'

/** Every string this picker shows is a prop, so a test names its own. */
const LABELS = {
  clear: 'Everywhere',
  empty: 'Nothing matched',
  label: 'Narrow to a group',
  placeholder: 'Every group',
}

/** The picker as a screen uses it: what it chooses is what it then holds. */
function Field() {
  const [chosen, setChosen] = useState<GroupRef | null>(null)

  return (
    <GroupPicker
      chosen={chosen}
      labels={LABELS}
      onChoose={(fullPath) => {
        setChosen(fullPath === '' ? null : SQUAD)
      }}
    />
  )
}

describe('GroupPicker', () => {
  it('asks the provider for what the reader typed, rather than filtering the page it has', async () => {
    const timelogs = fakeTeamGateway()

    renderReport(<Field />, { timelogs })

    await userEvent.type(await screen.findByRole('combobox', { name: LABELS.label }), 'taxplus')

    await waitFor(() => {
      expect(timelogs.groups).toHaveBeenCalledWith('taxplus', expect.anything())
    })
  })

  it('does not ask again for the group it already holds', async () => {
    const timelogs = fakeTeamGateway()

    renderReport(<Field />, { timelogs })

    await userEvent.click(await screen.findByRole('combobox', { name: LABELS.label }))
    await userEvent.click(await screen.findByRole('option', { name: new RegExp(SQUAD.name) }))

    // Base UI writes the chosen name back into the field when the popup closes.
    // Treating that as a search would re-ask the provider for a group already in
    // hand and reopen the list filtered down to the one item already chosen.
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: LABELS.label })).toHaveValue(SQUAD.name)
    })
    expect(timelogs.groups).toHaveBeenCalledTimes(1)
    expect(timelogs.groups).toHaveBeenCalledWith(null, expect.anything())
  })

  it('offers the way back to the whole reach first, above whatever the search found', async () => {
    renderReport(<Field />)

    await userEvent.click(await screen.findByRole('combobox', { name: LABELS.label }))

    const offered = await screen.findAllByRole('option')

    expect(offered[0]).toHaveTextContent(LABELS.clear)
  })

  it('offers no way back where there is nothing to go back to', async () => {
    // Seeding a team from a group has no meaningful "no group": there would be
    // nobody to suggest. Leaving the label out is what makes it unclearable.
    const { empty, label, placeholder } = LABELS

    renderReport(
      <GroupPicker chosen={null} labels={{ empty, label, placeholder }} onChoose={vi.fn()} />,
    )

    await userEvent.click(await screen.findByRole('combobox', { name: LABELS.label }))

    expect(await screen.findAllByRole('option')).toHaveLength(1)
  })
})
