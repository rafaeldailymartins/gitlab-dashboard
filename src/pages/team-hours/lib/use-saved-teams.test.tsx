import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fakeTeamsGateway, renderReport } from '~tests/support/report'

import type { Team, TeamsDocument, TeamsGateway } from '@/entities/teams'

import { TeamsError } from '@/entities/teams'

import { useSavedTeams } from './use-saved-teams'

const FISCAL: Team = {
  id: '018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d70',
  members: [],
  name: 'Squad Fiscal',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

/** A store that will not answer, for whatever reason the test hands it. */
function refusingGateway(error: Error) {
  return {
    read: vi.fn(() => Promise.reject(error)),
    write: vi.fn((document: TeamsDocument) => Promise.resolve(document)),
  } satisfies TeamsGateway
}

/** The three answers the hook has, as one line of text. */
function Saved() {
  const { failure, loading, teams } = useSavedTeams()

  if (loading) {
    return <span>reading</span>
  }

  return <span>{failure?.kind ?? teams.map((team) => team.name).join(', ')}</span>
}

describe('useSavedTeams', () => {
  it('hands over the teams the store holds', async () => {
    renderReport(<Saved />, { teams: fakeTeamsGateway([FISCAL]) })

    expect(await screen.findByText(FISCAL.name)).toBeInTheDocument()
  })

  it('reports the store’s own refusal exactly as the store stated it', async () => {
    const teams = refusingGateway(new TeamsError({ kind: 'identity-unavailable' }))

    renderReport(<Saved />, { teams })

    expect(await screen.findByText('identity-unavailable')).toBeInTheDocument()
  })

  it('reports anything else as unreachable, rather than inventing a diagnosis', async () => {
    // A socket that closed says nothing about why. Naming a cause here would be
    // a guess presented to the reader as a finding.
    renderReport(<Saved />, { teams: refusingGateway(new Error('socket closed')) })

    expect(await screen.findByText('unavailable')).toBeInTheDocument()
  })
})
