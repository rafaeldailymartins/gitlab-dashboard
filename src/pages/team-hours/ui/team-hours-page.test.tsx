import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ANA, BRUNO, CAMILA, entry, member } from '~tests/support/gitlab-team-timelogs'
import { fakeTeamGateway, fakeTeamsGateway, renderRoutedReport, SQUAD } from '~tests/support/report'

import type { TeamHoursPage as PageType } from '@/entities/team-timelogs'
import type { Team } from '@/entities/teams'

import type { TeamSearch } from '../lib/search-params'

import { TeamHoursPage } from './team-hours-page'

const FISCAL: Team = {
  id: '018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d70',
  members: [member(ANA), member(BRUNO)],
  name: 'Squad Fiscal',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

const MAY: TeamSearch = { by: 'days', group: '', month: '2026-05', team: FISCAL.id }
const HOUR = 3600

/** Ana logged six hours; Bruno logged nothing and the provider resolved both. */
function loggedGateway() {
  return fakeTeamGateway({
    pages: [
      {
        members: [
          {
            declared: { entryCount: 1, seconds: 6 * HOUR },
            entries: [entry('2026-05-04T09:00:00Z', 6 * HOUR)],
            nextCursor: null,
            person: ANA,
          },
          {
            declared: { entryCount: 0, seconds: 0 },
            entries: [],
            nextCursor: null,
            person: BRUNO,
          },
        ],
      },
    ],
  })
}

function page(
  overrides: Partial<TeamSearch> = {},
  timelogs = loggedGateway(),
  teams = fakeTeamsGateway([FISCAL]),
) {
  const onChange = vi.fn()
  // Routed, because the screen links to the teams screen — and a link is what
  // this app's answer to "you have no teams yet" is made of.
  const view = renderRoutedReport(
    <TeamHoursPage onChange={onChange} search={{ ...MAY, ...overrides }} />,
    { teams, timelogs },
  )

  return { ...view, onChange }
}

/**
 * One round that arrives and a second that never does.
 *
 * A fake that answered the second round with the first would read forever,
 * because the cursor would never run out — and what this describes is the state
 * before the last round lands, not a provider that misbehaves.
 */
function readingGateway() {
  const gateway = fakeTeamGateway()
  const parked: ((page: PageType) => void)[] = []

  gateway.timelogs = vi.fn(() =>
    Promise.resolve({
      members: [
        {
          declared: { entryCount: 2, seconds: 6 * HOUR },
          entries: [entry('2026-05-04T09:00:00Z', 6 * HOUR)],
          nextCursor: 'MQ',
          person: ANA,
        },
        { declared: { entryCount: 0, seconds: 0 }, entries: [], nextCursor: null, person: BRUNO },
      ],
    }),
  )
  gateway.following = vi.fn(
    () =>
      new Promise<PageType>((resolve) => {
        parked.push(resolve)
      }),
  )

  return {
    /** Delivers the continuation, ending the window. */
    finish: () => {
      for (const resolve of parked) {
        resolve({ members: [{ declared: null, entries: [], nextCursor: null, person: ANA }] })
      }
    },
    gateway,
  }
}

/** Ana's month, four hours of which the provider counted and would not show. */
function shortGateway() {
  return fakeTeamGateway({
    pages: [
      {
        members: [
          {
            declared: { entryCount: 3, seconds: 10 * HOUR },
            entries: [entry('2026-05-04T09:00:00Z', 6 * HOUR)],
            nextCursor: null,
            person: ANA,
          },
        ],
      },
    ],
  })
}

/** The last cell of somebody’s row, which is where their total goes. */
function totalCellOf(name: string): HTMLElement | undefined {
  const row = screen
    .getAllByRole('row')
    .find((one) => within(one).queryByRole('rowheader', { name }))

  return row === undefined ? undefined : within(row).getAllByRole('cell').at(-1)
}

describe('choosing what to look at', () => {
  it('asks the reader to build a team before reporting on one', async () => {
    page({ team: '' }, loggedGateway(), fakeTeamsGateway([]))

    expect(await screen.findByText(/no teams yet/i)).toBeInTheDocument()
  })

  it('tells a reader following a link that the team is gone, rather than showing their own', async () => {
    // An address that names a team always wins, exactly as the group address
    // used to: a link somebody sent outranks a convenient fallback.
    page({ team: FISCAL.id }, loggedGateway(), fakeTeamsGateway([]))

    expect(await screen.findByText(/not one of yours/i)).toBeInTheDocument()
  })

  it('says so when the address names a team this reader does not have', async () => {
    page({ team: '018f3b2c-7a41-7c9e-9f2d-000000000000' })

    expect(await screen.findByText(/not one of yours/i)).toBeInTheDocument()
  })

  it('says there is nobody to report on when the team is empty', async () => {
    const empty = fakeTeamsGateway([{ ...FISCAL, members: [] }])

    page({}, loggedGateway(), empty)

    expect(await screen.findByText(/nobody is on this team/i)).toBeInTheDocument()
  })

  it('puts the chosen team in the address', async () => {
    const second: Team = { ...FISCAL, id: '018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d71', name: 'Platform' }
    const { onChange } = page({}, loggedGateway(), fakeTeamsGateway([FISCAL, second]))

    // Opened and pressed, not `selectOptions`: this is the app's own listbox now,
    // sharing its panel with the group filter beside it, and a native select's
    // helper would silently pass against a control that had stopped being one.
    //
    // Waited for longer than the default second: the picker is code-split for the
    // floating popup it opens, and it is not rendered at all until the store has
    // said which teams there are — so this waits on a round trip and a chunk.
    await userEvent.click(
      await screen.findByRole('combobox', { name: /^team$/i }, { timeout: 5000 }),
    )
    await userEvent.click(await screen.findByRole('option', { name: second.name }))

    expect(onChange).toHaveBeenCalledWith({ team: second.id })
  })

  it('moves the month through the address rather than through its own state', async () => {
    const { onChange } = page()

    await userEvent.click(await screen.findByRole('button', { name: /previous month/i }))

    expect(onChange).toHaveBeenCalledWith({ month: '2026-04' })
  })

  it('moves the column axis through the address too', async () => {
    const { onChange } = page()

    await userEvent.click(await screen.findByRole('button', { name: /^weeks$/i }))

    expect(onChange).toHaveBeenCalledWith({ by: 'weeks' })
  })
})

describe('what the figures cover', () => {
  it('claims every hour GitLab will show, when nothing narrows the report', async () => {
    page()

    expect(await screen.findByText(/wherever they logged it/i)).toBeInTheDocument()
  })

  it('claims only the group and its subgroups once one is chosen', async () => {
    page({ group: SQUAD.fullPath })

    expect(await screen.findByText(/narrowed to/i)).toBeInTheDocument()
  })

  it('reads the hours under the same narrowing it states', async () => {
    const timelogs = loggedGateway()

    page({ group: SQUAD.fullPath }, timelogs)

    await waitFor(() => {
      expect(timelogs.timelogs).toHaveBeenCalledWith(
        expect.objectContaining({ groupId: SQUAD.id }),
        expect.anything(),
      )
    })
  })

  it('asks the whole reach when nothing narrows it', async () => {
    const timelogs = loggedGateway()

    page({}, timelogs)

    await waitFor(() => {
      expect(timelogs.timelogs).toHaveBeenCalledWith(
        expect.objectContaining({ groupId: null }),
        expect.anything(),
      )
    })
  })

  it('puts the chosen filter in the address', async () => {
    const { onChange } = page()

    await userEvent.click(await screen.findByRole('combobox', { name: /narrow to a group/i }))
    await userEvent.click(await screen.findByRole('option', { name: new RegExp(SQUAD.name) }))

    expect(onChange).toHaveBeenCalledWith({ group: SQUAD.fullPath })
  })

  it('offers a way back to the whole reach', async () => {
    const { onChange } = page({ group: SQUAD.fullPath })

    await userEvent.click(await screen.findByRole('combobox', { name: /narrow to a group/i }))
    await userEvent.click(await screen.findByRole('option', { name: /everywhere/i }))

    expect(onChange).toHaveBeenCalledWith({ group: '' })
  })

  it('says so rather than reporting everything when the group cannot be read', async () => {
    page({ group: 'acme/secret' }, fakeTeamGateway({ group: null }))

    expect(await screen.findByText(/could not be read/i)).toBeInTheDocument()
  })
})

describe('the matrix', () => {
  it('gives a row to everybody the team names', async () => {
    page()

    expect(await screen.findByRole('rowheader', { name: new RegExp(ANA.name) })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: new RegExp(BRUNO.name) })).toBeInTheDocument()
  })

  it('keeps a row for somebody who logged nothing, because the reader chose them', async () => {
    page()

    await screen.findByText(/measured against/i)

    expect(totalCellOf(new RegExp(BRUNO.name).source)).toBeDefined()
  })

  it('gives one heading per day of the month', async () => {
    page()

    await screen.findByRole('rowheader', { name: new RegExp(ANA.name) })

    const days = screen.getAllByRole('row')[1]

    expect(within(days ?? document.body).getAllByRole('columnheader')).toHaveLength(31)
  })

  // Weekends used to carry the number alone, on the argument that a column
  // nobody is expected to log in has no room for the abbreviation. The tint says
  // *a* day expects nothing, not which one, so two columns in every seven were
  // left for the reader to work out — and the width was this table's own choice.
  it('names every weekday, weekends included', async () => {
    page()

    await screen.findByRole('rowheader', { name: new RegExp(ANA.name) })

    const days = screen.getAllByRole('row')[1]
    const headings = within(days ?? document.body).getAllByRole('columnheader')
    // 2 May 2026 is a Saturday, and 3 May a Sunday: the second and third columns.
    const weekend = [headings[1], headings[2]]

    for (const heading of weekend) {
      expect(heading).toHaveTextContent(/S(at|un)/u)
    }
  })

  it('states the reference the bars are measured against', async () => {
    page()

    expect(await screen.findByText(/measured against/i)).toBeInTheDocument()
  })

  it('makes no cell a place the keyboard stops', async () => {
    page()

    await screen.findByRole('rowheader', { name: new RegExp(ANA.name) })

    // The only two the table has are the orderable headings. A month of cells
    // that each took focus would put the rest of the screen out of reach.
    expect(within(screen.getByRole('table')).getAllByRole('button')).toHaveLength(2)
  })
})

describe('somebody the provider would not resolve', () => {
  it('keeps their row under the name the reader stored', async () => {
    const stranger = fakeTeamsGateway([{ ...FISCAL, members: [member(CAMILA)] }])

    page({}, fakeTeamGateway({ pages: [{ members: [] }] }), stranger)

    expect(
      await screen.findByRole('rowheader', { name: new RegExp(CAMILA.name) }),
    ).toBeInTheDocument()
  })

  it('says GitLab did not recognise them, rather than drawing a month of zeros', async () => {
    const stranger = fakeTeamsGateway([{ ...FISCAL, members: [member(CAMILA)] }])

    page({}, fakeTeamGateway({ pages: [{ members: [] }] }), stranger)

    expect(await screen.findByText(/did not recognise/i)).toBeInTheDocument()
  })
})

describe('while the month is still being read', () => {
  it('reserves space for a person’s total rather than showing a figure that will change', async () => {
    page({}, readingGateway().gateway)

    await screen.findByRole('rowheader', { name: new RegExp(ANA.name) })

    await waitFor(() => {
      expect(totalCellOf(new RegExp(ANA.name).source)).toHaveTextContent('')
    })
  })

  it('says only that it is fetching, and nothing about the figures', async () => {
    page({}, readingGateway().gateway)

    await screen.findByRole('rowheader', { name: new RegExp(ANA.name) })

    // This region is the sync state and nothing else: when the hours arrived,
    // whether they are arriving now, whether asking failed. A caveat about a
    // person's hours belongs on that person's row, beside the figure.
    expect(screen.getByRole('status')).toHaveTextContent(/updating/i)
    expect(screen.getByRole('status')).not.toHaveTextContent(/did not show|hidden/i)
  })

  it('shows the totals once the last round lands', async () => {
    const { finish, gateway } = readingGateway()

    page({}, gateway)
    await screen.findByRole('rowheader', { name: new RegExp(ANA.name) })
    finish()

    // Six hours arrived on the first round; the reserved space becomes the
    // figure only now, when there is no longer a round that could change it.
    expect(await screen.findByText('6')).toBeInTheDocument()
  })
})

describe('what the provider would not show', () => {
  it('states the shortfall on the row it belongs to', async () => {
    page(
      {},
      fakeTeamGateway({
        pages: [
          {
            members: [
              {
                declared: { entryCount: 3, seconds: 10 * HOUR },
                entries: [entry('2026-05-04T09:00:00Z', 6 * HOUR)],
                nextCursor: null,
                person: ANA,
              },
            ],
          },
        ],
      }),
    )

    await screen.findByRole('rowheader', { name: new RegExp(ANA.name) })

    expect(await screen.findByText(/\+4 h hidden/i)).toBeInTheDocument()
    // Never in the sync region: that answers three questions and none of them
    // is about a figure.
    expect(screen.getByRole('status')).not.toHaveTextContent(/hidden/i)
  })

  it('does not ask which day the missing hours fell on when nothing narrows the report', async () => {
    // The column probe costs one request per short row against the provider's
    // database. Unnarrowed, a reader sees every colleague's working life through
    // their own permissions, so almost every row is short — and marking six of
    // them while the rest keep the note is a difference on screen that
    // corresponds to nothing about the data.
    const timelogs = shortGateway()

    page({}, timelogs)

    await screen.findByText(/\+4 h hidden/i)

    expect(timelogs.columns).not.toHaveBeenCalled()
  })

  it('asks which day they fell on once the report is narrowed to a group', async () => {
    // Narrowed, being short means something again: the reader chose a group
    // they can mostly open, so a row short in it is worth locating.
    const timelogs = shortGateway()

    page({ group: SQUAD.fullPath }, timelogs)

    await screen.findByText(/\+4 h hidden/i)

    await waitFor(() => {
      expect(timelogs.columns).toHaveBeenCalledWith(
        expect.objectContaining({ groupId: SQUAD.id, memberId: ANA.id }),
        expect.anything(),
      )
    })
  })

  it('says nothing about a shortfall when there is none', async () => {
    page()

    await screen.findByRole('rowheader', { name: new RegExp(ANA.name) })

    expect(screen.getByRole('status')).not.toHaveTextContent(/hidden/i)
  })
})
