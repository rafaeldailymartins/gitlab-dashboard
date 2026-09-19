import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ANA, BRUNO, CAMILA, member } from '~tests/support/gitlab-team-timelogs'
import { fakeTeamsGateway, renderReport } from '~tests/support/report'

import type { Team, TeamsGateway } from '@/entities/teams'

import { TeamsPage } from './teams-page'

const FISCAL: Team = {
  id: '018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d70',
  members: [member(ANA), member(BRUNO)],
  name: 'Squad Fiscal',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

const GUILD: Team = {
  id: '018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d71',
  members: [member(CAMILA)],
  name: 'Platform Guild',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

function nameField() {
  return screen.findByRole('textbox', { name: /team name/iu })
}

function page(teams: TeamsGateway = fakeTeamsGateway([FISCAL])) {
  return renderReport(<TeamsPage />, { teams })
}

function removeButton(name: string) {
  return screen.findByRole('button', { name: new RegExp(`remove ${name}`, 'iu') })
}

describe('the teams a reader keeps', () => {
  it('invites a reader who keeps none to start one', async () => {
    page(fakeTeamsGateway([]))

    expect(await screen.findByText(/no teams yet/iu)).toBeInTheDocument()
  })

  it('stops inviting once there is a team', async () => {
    page()

    await nameField()

    expect(screen.queryByText(/no teams yet/iu)).not.toBeInTheDocument()
  })

  it('saves a new team, and opens that one rather than the first', async () => {
    const teams = fakeTeamsGateway([FISCAL])

    page(teams)
    await userEvent.click(await screen.findByRole('button', { name: 'New team' }))

    expect(teams.write).toHaveBeenCalledWith(
      expect.objectContaining({
        teams: [FISCAL, expect.objectContaining({ members: [], name: 'New team' })],
      }),
    )
    expect(await screen.findByDisplayValue('New team')).toBeInTheDocument()
  })

  it('saves when somebody is taken off the team', async () => {
    const teams = fakeTeamsGateway([FISCAL])

    page(teams)
    await userEvent.click(await removeButton(ANA.name))

    expect(teams.write).toHaveBeenCalledWith(
      expect.objectContaining({ teams: [expect.objectContaining({ members: [member(BRUNO)] })] }),
    )
    await waitFor(() => {
      expect(screen.queryByText(`@${ANA.username}`)).not.toBeInTheDocument()
    })
  })

  it('deletes a team and falls back to whatever is left', async () => {
    const teams = fakeTeamsGateway([FISCAL, GUILD])

    page(teams)
    await userEvent.click(await screen.findByRole('button', { name: GUILD.name }))
    await userEvent.click(screen.getByRole('button', { name: /delete this team/iu }))

    expect(teams.write).toHaveBeenCalledWith(expect.objectContaining({ teams: [FISCAL] }))
    expect(await screen.findByDisplayValue(FISCAL.name)).toBeInTheDocument()
  })
})

describe('renaming a team', () => {
  it('commits when the field is left, and not on the way there', async () => {
    const teams = fakeTeamsGateway([FISCAL])

    page(teams)
    const field = await nameField()
    await userEvent.clear(field)
    await userEvent.type(field, 'Squad Tributário')

    // A save per letter would be twenty conditional writes racing each other
    // over one rename, and what loses that race is the reader's own name.
    expect(teams.write).not.toHaveBeenCalled()

    await userEvent.tab()

    expect(teams.write).toHaveBeenCalledTimes(1)
    expect(teams.write).toHaveBeenCalledWith(
      expect.objectContaining({ teams: [expect.objectContaining({ name: 'Squad Tributário' })] }),
    )
  })

  it('commits on Enter, without waiting for the field to be left', async () => {
    const teams = fakeTeamsGateway([FISCAL])

    page(teams)
    const field = await nameField()
    await userEvent.clear(field)
    await userEvent.type(field, 'Platform Guild{Enter}')

    expect(teams.write).toHaveBeenCalledTimes(1)
    expect(teams.write).toHaveBeenCalledWith(
      expect.objectContaining({ teams: [expect.objectContaining({ name: 'Platform Guild' })] }),
    )
  })

  it('refuses a name the store would refuse, with a reason, rather than sending it', async () => {
    const teams = fakeTeamsGateway([FISCAL])

    page(teams)
    const field = await nameField()
    await userEvent.clear(field)
    await userEvent.tab()

    // Sending it would come back as a failure the reader cannot connect to
    // anything they typed, on a screen where every other edit saves silently.
    expect(field).toBeInvalid()
    expect(screen.getByText(/a name is needed/iu)).toBeInTheDocument()
    expect(teams.write).not.toHaveBeenCalled()
  })
})
