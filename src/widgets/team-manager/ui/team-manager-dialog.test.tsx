import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ANA, member } from '~tests/support/gitlab-team-timelogs'
import { fakeTeamsGateway, renderReport } from '~tests/support/report'

import type { Team } from '@/entities/teams'

import { TeamManagerDialog } from './team-manager-dialog'

const FISCAL: Team = {
  id: '018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d70',
  members: [member(ANA)],
  name: 'Squad Fiscal',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

function dialog(onOpenChange = vi.fn()) {
  return {
    onOpenChange,
    ...renderReport(<TeamManagerDialog onOpenChange={onOpenChange} open />, {
      teams: fakeTeamsGateway([FISCAL]),
    }),
  }
}

describe('the teams dialog', () => {
  it('is titled and described, over whatever opened it', async () => {
    dialog()

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/^teams$/iu)).toBeInTheDocument()
    expect(screen.getByText(/hours logged in gitlab you can follow/iu)).toBeInTheDocument()
  })

  it('shows the teams it was opened for', async () => {
    dialog()

    expect(await screen.findByDisplayValue(FISCAL.name)).toBeInTheDocument()
  })

  // Closing is the caller's to do: the report underneath keeps the state, so a
  // dialog that closed itself would leave the two disagreeing about whether it
  // is open.
  it('asks to be closed rather than closing itself', async () => {
    const { onOpenChange } = dialog()

    await userEvent.click(await screen.findByRole('button', { name: /close/iu }))

    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
