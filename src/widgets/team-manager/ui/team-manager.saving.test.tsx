import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ANA, BRUNO, CAMILA, member } from '~tests/support/gitlab-team-timelogs'
import { renderReport } from '~tests/support/report'

import type { Team, TeamsDocument, TeamsFailure, TeamsGateway } from '@/entities/teams'

import { TeamsError } from '@/entities/teams'

import { TeamManager } from './team-manager'

const FISCAL: Team = {
  id: '018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d70',
  members: [member(ANA), member(BRUNO)],
  name: 'Squad Fiscal',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

/** A store that reads back fine and answers the write with somebody else's document. */
function contestedTeams(theirs: TeamsDocument) {
  return {
    read: vi.fn(() => Promise.resolve({ etag: '"1"', teams: [FISCAL] })),
    write: vi.fn(() => Promise.reject(new TeamsError({ current: theirs, kind: 'conflict' }))),
  } satisfies TeamsGateway
}

/**
 * A store whose writes are held open until the test lets them land.
 *
 * What the notice says is a question about the moment between the click and the
 * answer, and a store that resolves immediately never has one.
 */
function deferredTeams(initial: readonly Team[]) {
  const held: { resolve: (written: TeamsDocument) => void; sent: TeamsDocument }[] = []

  const gateway = {
    read: vi.fn(() => Promise.resolve({ etag: '"1"', teams: initial })),
    write: vi.fn(
      (sent: TeamsDocument) =>
        new Promise<TeamsDocument>((resolve) => held.push({ resolve, sent })),
    ),
  } satisfies TeamsGateway

  return {
    /** Lets every held write land, under the version the store would answer with. */
    finish: () => {
      for (const { resolve, sent } of held) {
        resolve({ etag: '"2"', teams: sent.teams })
      }
    },
    gateway,
  }
}

function manager(teams: TeamsGateway) {
  return renderReport(<TeamManager />, { teams })
}

/** A store that will not answer at all, for the two reasons that happens. */
function refusingTeams(failure: TeamsFailure) {
  return {
    read: vi.fn(() => Promise.reject(new TeamsError(failure))),
    write: vi.fn(() => Promise.reject(new TeamsError(failure))),
  } satisfies TeamsGateway
}

function removeButton(name: string) {
  return screen.findByRole('button', { name: new RegExp(`remove ${name}`, 'iu') })
}

describe('what a save says', () => {
  it('says it is saving, and then that it saved', async () => {
    const { finish, gateway } = deferredTeams([FISCAL])

    manager(gateway)
    await userEvent.click(await removeButton(ANA.name))

    expect(screen.getByRole('status')).toHaveTextContent(/saving/iu)

    finish()

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/^saved/iu)
    })
  })

  it('announces politely, and leaves the focus where the reader put it', async () => {
    const { finish, gateway } = deferredTeams([FISCAL])

    manager(gateway)
    const remove = await removeButton(ANA.name)
    await userEvent.click(remove)

    // A reader clicking ten names should not be interrupted ten times, which is
    // what an assertive region — or one that took the cursor — would do.
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(remove).toHaveFocus()

    finish()

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/^saved/iu)
    })
  })

  it('shows the version somebody else wrote, rather than the change that lost', async () => {
    const theirs: TeamsDocument = {
      etag: '"9"',
      teams: [{ ...FISCAL, members: [member(ANA), member(BRUNO), member(CAMILA)] }],
    }

    manager(contestedTeams(theirs))
    await userEvent.click(await removeButton(ANA.name))

    expect(await screen.findByText(/changed somewhere else/iu)).toBeInTheDocument()
    // Camila is theirs, and Ana is back: the removal the reader asked for never
    // landed, so showing it would be showing them a list nobody holds.
    expect(screen.getByText(`@${CAMILA.username}`)).toBeInTheDocument()
    expect(screen.getByText(`@${ANA.username}`)).toBeInTheDocument()
  })

  it('says so when the store cannot be reached', async () => {
    manager(refusingTeams({ kind: 'unavailable' }))

    expect(await screen.findByText(/could not be loaded/iu)).toBeInTheDocument()
  })

  it('asks a session that predates the identity scope to sign in again', async () => {
    manager(refusingTeams({ kind: 'identity-unavailable' }))

    expect(await screen.findByText(/sign in again/iu)).toBeInTheDocument()
    // Not an outage: waiting repairs one of these two failures and never the
    // other, so one sentence for both would send this reader waiting forever.
    expect(screen.queryByText(/could not be loaded/iu)).not.toBeInTheDocument()
  })
})
