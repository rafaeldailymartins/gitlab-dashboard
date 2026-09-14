import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ANA, BRUNO, entry, member } from '~tests/support/gitlab-group-timelogs'
import { fakeGroupGateway, renderReport, SQUAD } from '~tests/support/report'

import type { GroupHoursPage } from '@/entities/group-timelogs'

import type { TeamSearch } from '../lib/search-params'

import { TeamHoursPage } from './team-hours-page'

const MAY: TeamSearch = { by: 'days', group: SQUAD.fullPath, month: '2026-05' }
const HOUR = 3600

function loggedGateway() {
  return fakeGroupGateway({
    pages: [
      {
        entries: [entry(ANA, '2026-05-04T09:00:00Z', 6 * HOUR)],
        group: SQUAD,
        nextCursor: null,
      },
    ],
    probe: {
      access: null,
      declared: { entryCount: 1, seconds: 6 * HOUR },
      group: SQUAD,
      perPerson: new Map(),
    },
    roster: { access: null, group: SQUAD, members: [member(ANA), member(BRUNO)] },
  })
}

function page(overrides: Partial<TeamSearch> = {}, gateway = fakeGroupGateway()) {
  const onChange = vi.fn()
  const view = renderReport(
    <TeamHoursPage onChange={onChange} search={{ ...MAY, ...overrides }} />,
    {
      groups: gateway,
    },
  )

  return { ...view, onChange }
}

/**
 * One page that arrives and a second that never does.
 *
 * A fake that answered the second page with the first would page forever,
 * because the cursor would never run out — and what this describes is the
 * state before the last page lands, not a provider that misbehaves.
 */
function pagingGateway() {
  const gateway = fakeGroupGateway({
    roster: { access: null, group: SQUAD, members: [member(ANA), member(BRUNO)] },
  })
  const parked: ((page: GroupHoursPage) => void)[] = []
  let call = 0

  gateway.timelogs = vi.fn(() => {
    call += 1

    if (call > 1) {
      // The page that has not arrived. Its resolver is parked so a test can
      // deliver it and watch the figures settle.
      return new Promise<GroupHoursPage>((resolve) => {
        parked.push(resolve)
      })
    }

    return Promise.resolve({
      entries: [entry(ANA, '2026-05-04T09:00:00Z', 6 * HOUR)],
      group: SQUAD,
      nextCursor: 'MQ',
    })
  })

  return {
    /** Delivers the last page, ending the window. */
    finish: () => {
      for (const resolve of parked) {
        resolve({ entries: [], group: SQUAD, nextCursor: null })
      }
    },
    gateway,
  }
}

/** The last cell of somebody’s row, which is where their total goes. */
function totalCellOf(name: string): HTMLElement | undefined {
  const row = screen
    .getAllByRole('row')
    .find((one) => within(one).queryByRole('rowheader', { name }))

  return row === undefined ? undefined : within(row).getAllByRole('cell').at(-1)
}

describe('choosing what to look at', () => {
  it('asks for a group before reporting on one', () => {
    page({ group: '' })

    expect(screen.getByText(/choose a group/i)).toBeInTheDocument()
  })

  it('says what the figures cover, beside them', async () => {
    page({}, loggedGateway())

    expect(await screen.findByText(/subgroups/i)).toBeInTheDocument()
  })

  it('moves the month through the address rather than through its own state', async () => {
    const { onChange } = page({}, loggedGateway())

    await userEvent.click(screen.getByRole('button', { name: /previous month/i }))

    expect(onChange).toHaveBeenCalledWith({ month: '2026-04' })
  })

  it('moves the column axis through the address too', async () => {
    const { onChange } = page({}, loggedGateway())

    await userEvent.click(screen.getByRole('button', { name: /^weeks$/i }))

    expect(onChange).toHaveBeenCalledWith({ by: 'weeks' })
  })
})

describe('the group picker', () => {
  const OTHER = { fullPath: 'invent-software/devkit', name: 'DevKit' }

  function pickerGateway() {
    return fakeGroupGateway({ groups: [SQUAD, OTHER] })
  }

  it('opens its list when the field is clicked, rather than standing open', async () => {
    page({ group: '' }, pickerGateway())

    const field = await screen.findByRole('combobox', { name: /group/i })

    // Asserted after the field has arrived, or it would hold for a picker that
    // had not rendered at all.
    expect(screen.queryByRole('option')).not.toBeInTheDocument()

    await userEvent.click(field)

    expect(await screen.findByRole('option', { name: new RegExp(OTHER.name) })).toBeInTheDocument()
  })

  it('asks the provider to search, rather than filtering the page it has', async () => {
    const gateway = pickerGateway()

    page({ group: '' }, gateway)

    const field = await screen.findByRole('combobox', { name: /group/i })

    await userEvent.click(field)
    await userEvent.type(field, 'dev')

    // The search reaches groups whose own name holds none of what was typed —
    // a squad found through its parent's path — so the filtering has to be the
    // provider's rather than this list's.
    await waitFor(() => {
      expect(gateway.groups).toHaveBeenCalledWith('dev', expect.anything())
    })
  })

  it('puts the chosen group in the address', async () => {
    const { onChange } = page({ group: '' }, pickerGateway())

    await userEvent.click(await screen.findByRole('combobox', { name: /group/i }))
    await userEvent.click(await screen.findByRole('option', { name: new RegExp(OTHER.name) }))

    expect(onChange).toHaveBeenCalledWith({ group: OTHER.fullPath })
  })

  it('shows the chosen group by name once one is chosen', async () => {
    page({}, loggedGateway())

    // The address carries a path, and the name only arrives with the report —
    // so the field opens on the path and settles on the name.
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /group/i })).toHaveValue(SQUAD.name)
    })
  })
})

describe('the matrix', () => {
  it('gives a row to whoever has something to show', async () => {
    page({}, loggedGateway())

    expect(await screen.findByRole('rowheader', { name: ANA.name })).toBeInTheDocument()
  })

  it('leaves a member with nothing to show out of the table', async () => {
    page({}, loggedGateway())

    // Bruno is on the roster and logged nothing. He arrives with the roster,
    // which is a second answer, so waiting for the group total is what makes
    // this assert that he was left out rather than that he had not arrived.
    await screen.findByText(/measured against/i)

    expect(
      screen.queryByRole('rowheader', { name: new RegExp(BRUNO.name) }),
    ).not.toBeInTheDocument()
  })

  it('gives one heading per day of the month', async () => {
    page({}, loggedGateway())

    await screen.findByRole('rowheader', { name: ANA.name })

    const days = screen.getAllByRole('row')[1]

    expect(within(days ?? document.body).getAllByRole('columnheader')).toHaveLength(31)
  })

  it('states the reference the bars are measured against', async () => {
    page({}, loggedGateway())

    expect(await screen.findByText(/measured against/i)).toBeInTheDocument()
  })

  it('makes no cell a place the keyboard stops', async () => {
    page({}, loggedGateway())

    await screen.findByRole('rowheader', { name: ANA.name })

    // The only two the table has are the orderable headings. A month of cells
    // that each took focus would put the rest of the screen out of reach.
    expect(within(screen.getByRole('table')).getAllByRole('button')).toHaveLength(2)
  })
})

describe('while the month is still being read', () => {
  it('reserves space for a person’s total rather than showing a figure that will change', async () => {
    page({}, pagingGateway().gateway)

    await screen.findByRole('rowheader', { name: ANA.name })

    // The total is the figure a reader acts on and the one this is about: until
    // the month has been read it holds reserved space, not a number that will
    // change. Cells earlier than the read frontier are settled and may hold one.
    await waitFor(() => {
      expect(totalCellOf(ANA.name)).toHaveTextContent('')
    })
  })

  it('leaves nobody out before the month has been read', async () => {
    page({}, pagingGateway().gateway)

    await screen.findByRole('rowheader', { name: ANA.name })

    // Until the last page lands, "logged nothing" is only "not read yet".
    // Dropping a row on it would take a colleague off the screen and put them
    // back a second later.
    expect(screen.getByRole('rowheader', { name: new RegExp(BRUNO.name) })).toBeInTheDocument()
  })

  it('says only that it is fetching, and nothing about the figures', async () => {
    page({}, pagingGateway().gateway)

    await screen.findByRole('rowheader', { name: ANA.name })

    // This region is the sync state and nothing else: when the hours arrived,
    // whether they are arriving now, whether asking failed. A caveat about a
    // person's hours belongs on that person's row, beside the figure.
    expect(screen.getByRole('status')).toHaveTextContent(/updating/i)
    expect(screen.getByRole('status')).not.toHaveTextContent(/did not show|guest/i)
  })

  it('shows the totals once the last page lands', async () => {
    const { finish, gateway } = pagingGateway()

    page({}, gateway)
    await screen.findByRole('rowheader', { name: ANA.name })
    finish()

    // Six hours arrived on the first page; the reserved space becomes the
    // figure only now, when there is no longer a page that could change it.
    expect(await screen.findByText('6')).toBeInTheDocument()
  })
})

describe('what the provider would not show', () => {
  it('states the shortfall once the month has been read', async () => {
    page(
      {},
      fakeGroupGateway({
        pages: [
          {
            entries: [entry(ANA, '2026-05-04T09:00:00Z', 6 * HOUR)],
            group: SQUAD,
            nextCursor: null,
          },
        ],
        probe: {
          access: { level: 10, name: 'GUEST' },
          declared: { entryCount: 3, seconds: 10 * HOUR },
          group: SQUAD,
          perPerson: new Map([[ANA.username, { entryCount: 3, seconds: 10 * HOUR }]]),
        },
        roster: { access: null, group: SQUAD, members: [member(ANA)] },
      }),
    )

    await screen.findByRole('rowheader', { name: ANA.name })

    // The shortfall needs the probe, which is a third answer and lands last.
    // It is stated on the row it belongs to, never in the sync region.
    expect(await screen.findByText(/\+4 h hidden/i)).toBeInTheDocument()
    // Never the access level. A reader does not need their own permissions
    // explained to them beside a refresh button.
    expect(screen.getByRole('status')).not.toHaveTextContent(/guest/i)
  })

  it('says nothing about a shortfall when there is none', async () => {
    page({}, loggedGateway())

    await screen.findByRole('rowheader', { name: ANA.name })

    expect(screen.getByRole('status')).not.toHaveTextContent(/did not show/i)
  })

  it('names a group it could not read', async () => {
    page(
      {},
      fakeGroupGateway({
        pages: [{ entries: [], group: null, nextCursor: null }],
        probe: {
          access: null,
          declared: { entryCount: 0, seconds: 0 },
          group: null,
          perPerson: new Map(),
        },
        roster: { access: null, group: null, members: [] },
      }),
    )

    expect(await screen.findByText(/could not be read/i)).toBeInTheDocument()
  })
})
