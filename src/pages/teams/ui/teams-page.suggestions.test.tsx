import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ANA, BRUNO, DIEGO, member, suggestedMember } from '~tests/support/gitlab-team-timelogs'
import { fakeTeamGateway, fakeTeamsGateway, renderReport, SQUAD } from '~tests/support/report'

import type { Person, SuggestedMember, TeamTimelogGateway } from '@/entities/team-timelogs'
import type { Team, TeamsDocument, TeamsGateway } from '@/entities/teams'

import { TeamsPage } from './teams-page'

const FISCAL: Team = {
  id: '018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d70',
  members: [member(ANA), member(BRUNO)],
  name: 'Squad Fiscal',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

/** An empty team, which is what a reader adding their first colleague is looking at. */
const NOBODY: Team = { ...FISCAL, members: [] }

/**
 * A store whose writes are held open until the test lets them land. Nothing here
 * is applied optimistically, so that window is the only one in which a name is
 * still on offer after the reader has already taken it.
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
    finish: () => {
      for (const { resolve, sent } of held) {
        resolve({ etag: '"2"', teams: sent.teams })
      }
    },
    gateway,
  }
}

function page(teams: TeamsGateway, timelogs: TeamTimelogGateway) {
  return renderReport(<TeamsPage />, { teams, timelogs })
}

/**
 * The group picker's own field, waited for longer than the default second: it is
 * code-split for the floating popup it opens, so whichever test renders it first
 * in a file pays for fetching the chunk before the field exists at all.
 */
function pickerField() {
  return screen.findByRole('combobox', { name: /group to suggest from/iu }, { timeout: 5000 })
}

/** The field that reaches past the suggestions, to anybody at all. */
function searchField() {
  return screen.findByRole('searchbox', { name: /search gitlab for a person/iu })
}

/** A provider that finds people by name. `fakeTeamGateway` finds nobody. */
function searchingGateway(found: readonly Person[]) {
  return { ...fakeTeamGateway(), people: vi.fn(() => Promise.resolve(found)) }
}

/** Picks the one group the provider offers, the way a reader does. */
async function seedFrom() {
  await userEvent.click(await pickerField())
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(SQUAD.name, 'u') }))
}

function suggestingGateway(people: readonly SuggestedMember[], partial = false) {
  return fakeTeamGateway({ suggestions: { partial, people } })
}

describe('suggesting people from a group', () => {
  it('asks the provider for nobody until a group is chosen', async () => {
    const timelogs = suggestingGateway([suggestedMember(DIEGO)])

    page(fakeTeamsGateway([NOBODY]), timelogs)
    await pickerField()

    // The picker is what seeds this. Reading a ninety-day window of somebody's
    // whole reach before they have said which group they mean spends a paged
    // read on a question nobody asked.
    expect(timelogs.suggestions).not.toHaveBeenCalled()
    expect(screen.queryByText(/logged time there since/iu)).not.toBeInTheDocument()
  })

  it('reads the group the reader picks', async () => {
    const timelogs = suggestingGateway([suggestedMember(DIEGO)])

    page(fakeTeamsGateway([NOBODY]), timelogs)
    await seedFrom()

    await waitFor(() => {
      expect(timelogs.suggestions).toHaveBeenCalledWith(
        expect.objectContaining({ fullPath: SQUAD.fullPath }),
        expect.anything(),
      )
    })
  })

  it('states the window the names were drawn from', async () => {
    page(fakeTeamsGateway([NOBODY]), suggestingGateway([suggestedMember(DIEGO)]))
    await seedFrom()

    // A list of names with no window behind it reads as the group's membership,
    // which it deliberately is not.
    expect(await screen.findByText(/logged time there since/iu)).toBeInTheDocument()
  })

  it('says when the reading stopped short of the whole group', async () => {
    page(fakeTeamsGateway([NOBODY]), suggestingGateway([suggestedMember(DIEGO)], true))
    await seedFrom()

    expect(await screen.findByText(/may be incomplete/iu)).toBeInTheDocument()
  })

  it('puts somebody the group suggests on the team, and saves', async () => {
    const teams = fakeTeamsGateway([NOBODY])

    page(teams, suggestingGateway([suggestedMember(DIEGO)]))
    await seedFrom()
    await userEvent.click(await screen.findByRole('button', { name: `Add ${DIEGO.name}` }))

    expect(teams.write).toHaveBeenCalledWith(
      expect.objectContaining({ teams: [expect.objectContaining({ members: [member(DIEGO)] })] }),
    )
    const people = await screen.findByRole('region', { name: /people on this team/iu })

    expect(await within(people).findByText(`@${DIEGO.username}`)).toBeInTheDocument()
  })

  it('does not offer somebody who is already on the team', async () => {
    const timelogs = suggestingGateway([suggestedMember(ANA), suggestedMember(DIEGO)])

    page(fakeTeamsGateway([FISCAL]), timelogs)
    await seedFrom()

    expect(await screen.findByRole('button', { name: `Add ${DIEGO.name}` })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `Add ${ANA.name}` })).not.toBeInTheDocument()
  })

  it('puts somebody on the team once, however many times their name is clicked', async () => {
    const { finish, gateway } = deferredTeams([NOBODY])

    page(gateway, suggestingGateway([suggestedMember(DIEGO)]))
    await seedFrom()
    const add = await screen.findByRole('button', { name: `Add ${DIEGO.name}` })
    await userEvent.click(add)
    await userEvent.click(add)
    finish()

    // A second row for one person would count their hours twice in every total
    // the report draws, which is the one way this list can make a figure wrong.
    expect(gateway.write).toHaveBeenLastCalledWith(
      expect.objectContaining({ teams: [expect.objectContaining({ members: [member(DIEGO)] })] }),
    )
    const people = await screen.findByRole('region', { name: /people on this team/iu })

    await waitFor(() => {
      expect(within(people).getAllByText(`@${DIEGO.username}`)).toHaveLength(1)
    })
  })
})

describe('adding anybody by name', () => {
  it('puts somebody the search finds on the team, and saves', async () => {
    const teams = fakeTeamsGateway([FISCAL])

    page(teams, searchingGateway([DIEGO]))
    await userEvent.type(await searchField(), 'diego')
    await userEvent.click(await screen.findByRole('button', { name: `Add ${DIEGO.name}` }))

    expect(teams.write).toHaveBeenCalledWith(
      expect.objectContaining({
        teams: [expect.objectContaining({ members: [member(ANA), member(BRUNO), member(DIEGO)] })],
      }),
    )
  })

  it('does not offer somebody who is already on the team', async () => {
    page(fakeTeamsGateway([FISCAL]), searchingGateway([ANA, DIEGO]))
    // Two letters, because one matches most of an instance and the field waits.
    await userEvent.type(await searchField(), 'an')

    // The search is the only way onto a team for somebody who has logged
    // nothing, so it reaches people the suggestions never would — including the
    // ones the reader already named.
    expect(await screen.findByRole('button', { name: `Add ${DIEGO.name}` })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `Add ${ANA.name}` })).not.toBeInTheDocument()
  })
})
