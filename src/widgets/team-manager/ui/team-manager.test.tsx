import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  ANA,
  BRUNO,
  CAMILA,
  DIEGO,
  member,
  suggestedMember,
} from '~tests/support/gitlab-team-timelogs'
import { fakeTeamGateway, fakeTeamsGateway, renderReport, SQUAD } from '~tests/support/report'

import type { TeamTimelogGateway } from '@/entities/team-timelogs'
import type { Team, TeamsGateway } from '@/entities/teams'

import { TeamManager } from './team-manager'

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

/** A provider whose group holds these people, whatever else it is asked. */
function groupOf(people: readonly ReturnType<typeof suggestedMember>[]) {
  return {
    ...fakeTeamGateway(),
    suggestions: vi.fn(() => Promise.resolve({ partial: false, people })),
  } satisfies TeamTimelogGateway
}

/** The group's own row in the list, which is a verb rather than a value. */
function groupRow() {
  return screen.findByRole('button', { name: new RegExp(SQUAD.name, 'iu') })
}

function manager(
  teams: TeamsGateway = fakeTeamsGateway([FISCAL]),
  timelogs: TeamTimelogGateway = fakeTeamGateway(),
) {
  return renderReport(<TeamManager />, { teams, timelogs })
}

function removeButton(name: string) {
  return screen.findByRole('button', { name: new RegExp(`remove ${name}`, 'iu') })
}

/**
 * Presses Save.
 *
 * Edits are collected and written once, so a test that edits and then asserts
 * against the store has to say when. That is the change, not an accident of the
 * harness: the assertion that used to prove a click reached the store now
 * proves a click and a save did.
 */
async function save() {
  await userEvent.click(await screen.findByRole('button', { name: /^save$/iu }))
}

describe('the teams a reader keeps', () => {
  it('opens on a team, listing who is on it', async () => {
    manager()

    expect(await screen.findByDisplayValue(FISCAL.name)).toBeInTheDocument()
    expect(screen.getByText(`@${ANA.username}`)).toBeInTheDocument()
  })

  // Not "you have no teams" with a button to find: starting one is the only
  // thing this reader can do, so it is what the pane opens on.
  it('opens on starting a team when the reader keeps none', async () => {
    manager(fakeTeamsGateway([]))

    expect(await screen.findByText(/start a team from a gitlab group/iu)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /back/iu })).not.toBeInTheDocument()
  })

  it('changes which team is showing', async () => {
    manager(fakeTeamsGateway([FISCAL, GUILD]))
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(GUILD.name, 'u') }))

    expect(await screen.findByDisplayValue(GUILD.name)).toBeInTheDocument()
  })

  it('takes somebody off the team', async () => {
    const teams = fakeTeamsGateway([FISCAL])

    manager(teams)
    await userEvent.click(await removeButton(ANA.name))
    await save()

    expect(teams.write).toHaveBeenCalledWith(
      expect.objectContaining({ teams: [expect.objectContaining({ members: [member(BRUNO)] })] }),
    )
    await waitFor(() => {
      expect(screen.queryByText(`@${ANA.username}`)).not.toBeInTheDocument()
    })
  })

  it('deletes a team and falls back to whatever is left', async () => {
    const teams = fakeTeamsGateway([FISCAL, GUILD])

    manager(teams)
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(GUILD.name, 'u') }))
    await userEvent.click(screen.getByRole('button', { name: /delete this team/iu }))
    await save()

    expect(teams.write).toHaveBeenCalledWith(expect.objectContaining({ teams: [FISCAL] }))
    expect(await screen.findByDisplayValue(FISCAL.name)).toBeInTheDocument()
  })

  it('says the store would not answer, rather than that there are no teams', async () => {
    const refusing = {
      read: vi.fn(() => Promise.reject(new Error('down'))),
      write: vi.fn(() => Promise.reject(new Error('down'))),
    } satisfies TeamsGateway

    manager(refusing)

    expect(await screen.findByText(/could not be loaded/iu)).toBeInTheDocument()
    // Inviting somebody to build a team they may already have is the worst
    // thing this surface can say.
    expect(screen.queryByText(/start a team from a gitlab group/iu)).not.toBeInTheDocument()
  })
})

describe('a team built from a group', () => {
  it('is minted already full, in one save, named after the group', async () => {
    const teams = fakeTeamsGateway([])

    manager(teams, groupOf([suggestedMember(ANA), suggestedMember(DIEGO)]))
    await userEvent.click(await groupRow())
    await save()

    await waitFor(() => {
      expect(teams.write).toHaveBeenCalledTimes(1)
    })
    expect(teams.write).toHaveBeenCalledWith(
      expect.objectContaining({
        teams: [
          expect.objectContaining({ members: [member(ANA), member(DIEGO)], name: SQUAD.name }),
        ],
      }),
    )
  })

  it('leaves out a bot, which nobody manages a timesheet for', async () => {
    const teams = fakeTeamsGateway([])

    manager(teams, groupOf([suggestedMember(ANA), suggestedMember(DIEGO, { bot: true })]))
    await userEvent.click(await groupRow())
    await save()

    await waitFor(() => {
      expect(teams.write).toHaveBeenCalledWith(
        expect.objectContaining({
          teams: [expect.objectContaining({ members: [member(ANA)] })],
        }),
      )
    })
  })

  // They logged the hours in the window, so the work is theirs and a month
  // already reported still has it in.
  it('keeps somebody whose account is no longer active', async () => {
    const teams = fakeTeamsGateway([])

    manager(teams, groupOf([suggestedMember(DIEGO, { active: false })]))
    await userEvent.click(await groupRow())
    await save()

    await waitFor(() => {
      expect(teams.write).toHaveBeenCalledWith(
        expect.objectContaining({
          teams: [expect.objectContaining({ members: [member(DIEGO)] })],
        }),
      )
    })
  })

  // The notice that used to say so is gone: a census that might be short is a
  // serious claim about a list that *is* the answer, and a mild one about a
  // starting point the reader is already looking at. What must not happen is the
  // opposite — the screen claiming these are everybody.
  it('builds the team from what a short read found, and claims nothing more', async () => {
    const teams = fakeTeamsGateway([])
    const short = {
      ...fakeTeamGateway(),
      suggestions: vi.fn(() => Promise.resolve({ partial: true, people: [suggestedMember(ANA)] })),
    } satisfies TeamTimelogGateway

    manager(teams, short)
    await userEvent.click(await groupRow())
    await save()

    await waitFor(() => {
      expect(teams.write).toHaveBeenCalledWith(
        expect.objectContaining({ teams: [expect.objectContaining({ members: [member(ANA)] })] }),
      )
    })
    expect(screen.queryByText(/everybody|all of them|complete/iu)).not.toBeInTheDocument()
    // And the way to add whoever it missed is on screen, not behind a control.
    expect(screen.getByRole('searchbox', { name: /search gitlab for a person/iu })).toBeVisible()
  })

  it('starts an empty one when the reader asks for that instead', async () => {
    const teams = fakeTeamsGateway([])

    manager(teams)
    await userEvent.click(await screen.findByRole('button', { name: /start an empty team/iu }))
    await save()

    expect(teams.write).toHaveBeenCalledWith(
      expect.objectContaining({
        teams: [expect.objectContaining({ members: [], name: 'New team' })],
      }),
    )
  })
})

function groupBox() {
  return screen.findByRole('searchbox', { name: /search your gitlab groups/iu })
}

function personBox() {
  return screen.findByRole('searchbox', { name: /search gitlab for a person/iu })
}

/** No delay between keystrokes, so a burst really is a burst. */
function typist() {
  return userEvent.setup({ delay: null })
}

/*
 * What a keystroke costs the provider.
 *
 * Nothing in this suite used to type into either search box — the acceptance
 * suite does, but it asserts what comes back, not how many times it was asked —
 * so removing the debounce would have left every gate green while each letter
 * became a GraphQL request, and the retry policy multiplied that by three on a
 * connection that was dropping them.
 */
/*
 * What "saved on purpose" buys, and what it costs.
 *
 * None of this was expressible before: every edit was its own write, so there
 * was no state in which something had been changed and not stored, and nothing
 * to discard.
 */
describe('edits that have not been saved', () => {
  it('does not store an edit until it is saved', async () => {
    const teams = fakeTeamsGateway([FISCAL])

    manager(teams)
    await userEvent.click(await removeButton(ANA.name))

    // On screen, because that is what the reader is editing.
    await waitFor(() => {
      expect(screen.queryByText(`@${ANA.username}`)).not.toBeInTheDocument()
    })
    expect(teams.write).not.toHaveBeenCalled()
  })

  it('puts back what was discarded, and stores nothing', async () => {
    const teams = fakeTeamsGateway([FISCAL])

    manager(teams)
    await userEvent.click(await removeButton(ANA.name))
    await userEvent.click(await screen.findByRole('button', { name: /^cancel$/iu }))

    expect(await screen.findByText(`@${ANA.username}`)).toBeInTheDocument()
    expect(teams.write).not.toHaveBeenCalled()
  })

  /*
   * The defect save-on-edit had, and the reason this is not only a matter of
   * taste. Two removals each built their write from the list as it was last
   * read and carried the version read with it, so the second was built on the
   * team before the first — reverting it, or being refused with the reader's
   * own two clicks reported as somebody else's change.
   */
  it('writes two removals once, and keeps both', async () => {
    const teams = fakeTeamsGateway([FISCAL])

    manager(teams)
    await userEvent.click(await removeButton(ANA.name))
    await userEvent.click(await removeButton(BRUNO.name))
    await save()

    await waitFor(() => {
      expect(teams.write).toHaveBeenCalledTimes(1)
    })
    expect(teams.write).toHaveBeenCalledWith(
      expect.objectContaining({ teams: [expect.objectContaining({ members: [] })] }),
    )
  })

  it('offers nothing to save or discard until something is edited', async () => {
    manager(fakeTeamsGateway([FISCAL]))

    expect(await screen.findByRole('button', { name: /^save$/iu })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^cancel$/iu })).toBeDisabled()
  })

  it('offers both once something is', async () => {
    manager(fakeTeamsGateway([FISCAL]))
    await userEvent.click(await removeButton(ANA.name))

    expect(await screen.findByRole('button', { name: /^save$/iu })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^cancel$/iu })).toBeEnabled()
  })

  // The name used to commit on blur and on Enter, so a save pressed while the
  // field still held text dropped the rename without saying anything.
  it('saves a name the reader typed but did not leave', async () => {
    const teams = fakeTeamsGateway([FISCAL])

    manager(teams)

    const field = await screen.findByDisplayValue(FISCAL.name)

    await userEvent.clear(field)
    await userEvent.type(field, 'Squad Fiscal e Tributário')
    await save()

    await waitFor(() => {
      expect(teams.write).toHaveBeenCalledWith(
        expect.objectContaining({
          teams: [expect.objectContaining({ name: 'Squad Fiscal e Tributário' })],
        }),
      )
    })
  })

  // Discarding reverts the team, and the field has to follow it — it is seeded
  // once and remounted only when another team is chosen, so without the
  // render-time follow it would sit there showing a rename that no longer
  // exists.
  it('puts the name back when the edits are discarded', async () => {
    manager(fakeTeamsGateway([FISCAL]))

    const field = await screen.findByDisplayValue(FISCAL.name)

    await userEvent.clear(field)
    await userEvent.type(field, 'Something else')
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/iu }))

    expect(await screen.findByDisplayValue(FISCAL.name)).toBeInTheDocument()
  })
})

describe('what a search asks the provider', () => {
  it('asks once for a name typed in one go, and asks for the whole of it', async () => {
    const timelogs = fakeTeamGateway()

    manager(fakeTeamsGateway([FISCAL]), timelogs)
    await typist().type(await personBox(), 'diego')

    await waitFor(() => {
      expect(timelogs.people).toHaveBeenCalledWith('diego', expect.anything())
    })
    expect(timelogs.people).toHaveBeenCalledTimes(1)
  })

  // The floor is two characters because `users(search: "")` is a page of
  // strangers. One character must therefore ask nothing at all.
  it('asks nothing for a single letter', async () => {
    const timelogs = fakeTeamGateway()

    manager(fakeTeamsGateway([FISCAL]), timelogs)
    await typist().type(await personBox(), 'd')
    await waitFor(() => {
      expect(screen.getByRole('searchbox', { name: /search gitlab for a person/iu })).toHaveValue(
        'd',
      )
    })

    expect(timelogs.people).not.toHaveBeenCalled()
  })

  it('asks once for a group typed in one go', async () => {
    const timelogs = fakeTeamGateway()

    manager(fakeTeamsGateway([]), timelogs)
    await typist().type(await groupBox(), 'taxplus')

    await waitFor(() => {
      expect(timelogs.groups).toHaveBeenCalledWith('taxplus', expect.anything())
    })
    // The first is the unfiltered list this list opens on; the second is the
    // whole word. Nothing in between reached the provider.
    expect(timelogs.groups).toHaveBeenCalledTimes(2)
    expect(timelogs.groups).not.toHaveBeenCalledWith('tax', expect.anything())
  })

  /*
   * A single letter is the unfiltered list rather than a disabled query, so it
   * shares the empty box's key and its answer. Asking again there would be a
   * request for something already in hand, and disabling it — which is what
   * this did before — emptied the list on the first keystroke and filled it
   * again on the second.
   */
  it('shows every group for a single letter without asking again', async () => {
    const timelogs = fakeTeamGateway()

    manager(fakeTeamsGateway([]), timelogs)
    await screen.findByRole('button', { name: new RegExp(SQUAD.name, 'iu') })
    await typist().type(await groupBox(), 't')

    expect(await groupRow()).toBeVisible()
    expect(timelogs.groups).toHaveBeenCalledTimes(1)
    expect(timelogs.groups).toHaveBeenCalledWith(null, expect.anything())
  })
})

describe('topping a team up from a group', () => {
  it('adds whoever is missing and takes nobody off', async () => {
    const teams = fakeTeamsGateway([FISCAL])

    // Ana is already on the team; Camila is not on the team and not in the
    // group, so a merge that reconciled both ways would drop her.
    manager(
      { ...teams, read: vi.fn(() => Promise.resolve({ etag: '"1"', teams: [withCamila()] })) },
      groupOf([suggestedMember(ANA), suggestedMember(DIEGO)]),
    )
    await userEvent.click(await screen.findByRole('button', { name: /add from a group/iu }))
    await userEvent.click(await groupRow())
    await save()

    await waitFor(() => {
      expect(teams.write).toHaveBeenCalledWith(
        expect.objectContaining({
          teams: [
            expect.objectContaining({
              members: [member(ANA), member(BRUNO), member(CAMILA), member(DIEGO)],
            }),
          ],
        }),
      )
    })
  })

  it('goes back to the team without changing it', async () => {
    const teams = fakeTeamsGateway([FISCAL])

    manager(teams)
    await userEvent.click(await screen.findByRole('button', { name: /add from a group/iu }))
    await userEvent.click(screen.getByRole('button', { name: /back/iu }))

    expect(await screen.findByDisplayValue(FISCAL.name)).toBeInTheDocument()
    expect(teams.write).not.toHaveBeenCalled()
  })
})

function withCamila(): Team {
  return { ...FISCAL, members: [...FISCAL.members, member(CAMILA)] }
}
