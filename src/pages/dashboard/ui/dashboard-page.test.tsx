import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  failingGateway,
  fakeGateway,
  renderReport,
  renderRoutedReport,
} from '~tests/support/report'

import type { TimelogEntry, TimelogPage } from '@/entities/timelogs'

import { GraphQLRequestError } from '@/shared/api'
import { memoryStorage } from '@/shared/lib/storage'

import { DashboardPage } from './dashboard-page'

/** A Friday, so the week under test runs Monday the 17th to Sunday the 23rd. */
const NOW = new Date('2026-08-21T15:00:00Z')

const PROJECT = {
  fullPath: 'invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
  name: 'invent.fiscal.inventariofiscal',
  webUrl: 'https://gitlab.com/invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
}

/** A promise this test settles itself, to hold a request open on purpose. */
function deferred<T>() {
  const handle: { resolve?: (value: T) => void } = {}
  const promise = new Promise<T>((resolve) => {
    handle.resolve = resolve
  })

  return {
    promise,
    settle(value: T) {
      handle.resolve?.(value)
    },
  }
}

function entry(day: string, seconds: number): TimelogEntry {
  return {
    project: PROJECT,
    seconds,
    spentAt: new Date(`${day}T15:00:00Z`),
    summary: null,
    workItem: null,
  }
}

function figure(label: string) {
  return within(screen.getByRole('group', { name: label }))
}

function withPreferences(preferences: Record<string, unknown>) {
  const storage = memoryStorage()
  storage.write('preferences', JSON.stringify(preferences))

  return storage
}

beforeEach(() => {
  // Only Date is faked: React Testing Library needs real timers to settle.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('DashboardPage', () => {
  it('shows what was logged today, this week and this month', async () => {
    const gateway = fakeGateway([
      {
        entries: [
          entry('2026-08-21', 24_120),
          entry('2026-08-18', 3600),
          entry('2026-08-03', 7200),
          entry('2026-07-30', 1800),
        ],
        nextCursor: null,
      },
    ])

    renderReport(<DashboardPage />, { gateway })

    await waitFor(() => {
      expect(figure('Today').getByRole('definition')).toHaveTextContent('6.7')
    })
    expect(figure('This week').getByRole('definition')).toHaveTextContent('7.7')
    expect(figure('This month').getByRole('definition')).toHaveTextContent('9.7')
  })

  it('reads a period with nothing logged as zero rather than as missing', async () => {
    renderReport(<DashboardPage />, { gateway: fakeGateway([{ entries: [], nextCursor: null }]) })

    await waitFor(() => {
      expect(figure('Today').getByRole('definition')).toHaveTextContent('0')
    })
    expect(screen.queryByText(/still loading/i)).not.toBeInTheDocument()
  })

  it('decides which day an entry belongs to in the reader time zone', async () => {
    // 02:00 UTC on the 21st is 23:00 on the 20th in Sao Paulo: yesterday.
    const gateway = fakeGateway([
      {
        entries: [{ ...entry('2026-08-21', 3600), spentAt: new Date('2026-08-21T02:00:00Z') }],
        nextCursor: null,
      },
    ])

    renderReport(<DashboardPage />, {
      gateway,
      storage: withPreferences({ timeZone: 'America/Sao_Paulo' }),
    })

    await waitFor(() => {
      expect(figure('Today').getByRole('definition')).toHaveTextContent('0')
    })
    expect(figure('This week').getByRole('definition')).toHaveTextContent('1')
  })

  it('shows the target each period is measured against', async () => {
    renderReport(<DashboardPage />)

    // Eight hours a day on the five weekdays of this week, and 21 weekdays in
    // August 2026.
    await waitFor(() => {
      expect(figure('Today').getByRole('definition')).toHaveTextContent('of 8 h')
    })
    expect(figure('This week').getByRole('definition')).toHaveTextContent('of 40 h')
    expect(figure('This month').getByRole('definition')).toHaveTextContent('of 168 h')
  })

  it('says nothing is settled yet while the month is still loading', async () => {
    const gateway = fakeGateway([
      { entries: [entry('2026-08-21', 3600)], nextCursor: 'older' },
      { entries: [entry('2026-08-20', 3600)], nextCursor: 'older-still' },
    ])

    renderReport(<DashboardPage />, { gateway })

    await waitFor(() => {
      expect(screen.getAllByText(/still loading/i).length).toBeGreaterThan(0)
    })
  })

  it('keeps loading older pages until the month is settled', async () => {
    const gateway = fakeGateway([
      { entries: [entry('2026-08-21', 3600)], nextCursor: 'older' },
      { entries: [entry('2026-08-10', 3600)], nextCursor: 'older-still' },
      { entries: [entry('2026-07-25', 3600)], nextCursor: null },
    ])

    renderReport(<DashboardPage />, { gateway })

    await waitFor(() => {
      expect(figure('This month').getByRole('definition')).toHaveTextContent('2')
    })
    expect(gateway.myTimelogs).toHaveBeenCalledTimes(3)
  })

  it('says when the hours arrived once the report has settled', async () => {
    renderReport(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/updated at \d{1,2}:\d{2}/i)
    })
  })

  it('reports an unreachable GitLab with a way to try again', async () => {
    const gateway = failingGateway(new GraphQLRequestError({ kind: 'unavailable' }))

    renderReport(<DashboardPage />, { gateway })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/could not be reached/i)
    })
    expect(screen.getByRole('button', { name: /sync with gitlab/i })).toBeInTheDocument()
  })

  it('asks the reader to sign in again when the credential is refused', async () => {
    const gateway = failingGateway(new GraphQLRequestError({ kind: 'unauthorized' }))

    renderReport(<DashboardPage />, { gateway })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/no longer accepts/i)
    })
  })

  it('re-requests the report when the reader tries again', async () => {
    const gateway = failingGateway(new GraphQLRequestError({ kind: 'unavailable' }))

    renderReport(<DashboardPage />, { gateway })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sync with gitlab/i })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('button', { name: /sync with gitlab/i }))

    await waitFor(() => {
      expect(gateway.myTimelogs.mock.calls.length).toBeGreaterThan(1)
    })
  })

  it('reports a request GitLab understood and refused', async () => {
    const refused = new GraphQLRequestError({ kind: 'rejected', messages: ['No such field'] })

    renderReport(<DashboardPage />, { gateway: failingGateway(refused) })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/refused the request/i)
    })
  })

  it('treats a failure it cannot classify as GitLab being unreachable', async () => {
    renderReport(<DashboardPage />, { gateway: failingGateway(new Error('Load failed')) })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/could not be reached/i)
    })
  })

  it.each([
    { expected: '1.5 h above target', seconds: 34_200 },
    { expected: 'Target met', seconds: 28_800 },
    { expected: '1.3 h to go', seconds: 24_120 },
  ])('reads $expected against an eight-hour target', async ({ expected, seconds }) => {
    const gateway = fakeGateway([{ entries: [entry('2026-08-21', seconds)], nextCursor: null }])

    renderReport(<DashboardPage />, { gateway })

    await waitFor(() => {
      expect(figure('Today').getByRole('definition')).toHaveTextContent(expected)
    })
  })

  it('says a day with no target has none, rather than inventing a percentage', async () => {
    // Friday given a zero target: the same case as a Saturday, which is why
    // `ratio` is null rather than a division by zero.
    const storage = withPreferences({ dailyTarget: { 1: 8, 2: 8, 3: 8, 4: 8, 5: 0, 6: 0, 7: 0 } })
    const gateway = fakeGateway([{ entries: [entry('2026-08-21', 3600)], nextCursor: null }])

    renderReport(<DashboardPage />, { gateway, storage })

    await waitFor(() => {
      expect(figure('Today').getByRole('definition')).toHaveTextContent('no target today')
    })
  })
  it('shows the week strip, the feed and the summary together', async () => {
    const gateway = fakeGateway([{ entries: [entry('2026-08-21', 24_120)], nextCursor: null }])

    renderRoutedReport(<DashboardPage />, { gateway })

    await waitFor(() => {
      expect(figure('Today').getByRole('definition')).toHaveTextContent('6.7')
    })
    expect(screen.getByRole('region', { name: /This week/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /History/i })).toBeInTheDocument()
  })

  it('opens the day a reader picks out of the week strip', async () => {
    const { router } = renderRoutedReport(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Wed/i })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('button', { name: /Wed/i }))

    expect(router.state.location.pathname).toBe('/days/2026-08-19')
  })

  it('lists the loaded days newest first in the feed', async () => {
    const gateway = fakeGateway([
      {
        entries: [entry('2026-08-21', 3600), entry('2026-08-19', 7200)],
        nextCursor: null,
      },
    ])

    renderRoutedReport(<DashboardPage />, { gateway })

    await waitFor(() => {
      expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(2)
    })
    const rows = screen.getAllByRole('button', { expanded: false })

    expect(rows.at(0)).toHaveTextContent('21')
    expect(rows.at(1)).toHaveTextContent('19')
  })

  it('asks for an older page when the reader wants more history', async () => {
    const gateway = fakeGateway([
      { entries: [entry('2026-08-21', 3600)], nextCursor: 'older' },
      { entries: [entry('2026-07-20', 3600)], nextCursor: null },
    ])

    renderRoutedReport(<DashboardPage />, { gateway })

    await waitFor(() => {
      expect(gateway.myTimelogs.mock.calls.length).toBeGreaterThan(1)
    })
    expect(gateway.myTimelogs).toHaveBeenLastCalledWith({ after: 'older' }, expect.anything())
  })
  it('asks for an older page when the reader presses for more history', async () => {
    const gateway = fakeGateway([
      { entries: [entry('2026-08-21', 3600), entry('2026-07-01', 3600)], nextCursor: 'older' },
      { entries: [entry('2026-06-30', 3600)], nextCursor: null },
    ])

    renderRoutedReport(<DashboardPage />, { gateway })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Load older days/i })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('button', { name: /Load older days/i }))

    await waitFor(() => {
      expect(screen.getByText(/whole history/i)).toBeInTheDocument()
    })
  })

  it('says it is updating while a refresh is in flight over the figures', async () => {
    const inFlight = deferred<TimelogPage>()
    const gateway = {
      myTimelogs: vi
        .fn()
        .mockResolvedValueOnce({ entries: [entry('2026-08-21', 3600)], nextCursor: null })
        .mockReturnValueOnce(inFlight.promise),
    }

    const { client } = renderReport(<DashboardPage />, { gateway })

    await waitFor(() => {
      expect(figure('Today').getByRole('definition')).toHaveTextContent('1')
    })
    void client.refetchQueries()

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/updating/i)
    })
    // The old figure stays put while the new one is on its way.
    expect(figure('Today').getByRole('definition')).toHaveTextContent('1')
    inFlight.settle({ entries: [entry('2026-08-21', 7200)], nextCursor: null })
  })
})
