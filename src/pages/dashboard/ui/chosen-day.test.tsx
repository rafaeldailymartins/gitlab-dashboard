import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeGateway, renderReport, renderRoutedReport } from '~tests/support/report'

import type { TimelogEntry, TimelogPage } from '@/entities/timelogs'

import { isoDate, type IsoDate } from '@/shared/lib/date'
import { memoryStorage } from '@/shared/lib/storage'

import { DashboardPage } from './dashboard-page'

/** A Friday: today is the 21st, and its week runs Monday the 17th to Sunday the 23rd. */
const NOW = new Date('2026-08-21T15:00:00Z')

function asOf(chosen: IsoDate | null, onChoose = vi.fn()) {
  return <DashboardPage chosen={chosen} onChoose={onChoose} />
}

function entry(day: string, seconds = 3600): TimelogEntry {
  return {
    project: null,
    seconds,
    spentAt: new Date(`${day}T12:00:00Z`),
    summary: null,
    workItem: null,
  }
}

function figure(label: RegExp | string) {
  return within(screen.getByRole('group', { name: label }))
}

/** A gateway whose second page is held open until the test lets it go. */
function heldGateway(first: TimelogPage) {
  const held = { release: (_page: TimelogPage): void => undefined }
  const myTimelogs = vi
    .fn()
    .mockResolvedValueOnce(first)
    .mockReturnValueOnce(
      new Promise<TimelogPage>((resolve) => {
        held.release = resolve
      }),
    )

  return { gateway: { myTimelogs }, held }
}

function inUtc() {
  const storage = memoryStorage()
  storage.write('preferences', JSON.stringify({ timeZone: 'UTC' }))

  return storage
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('a dashboard read as of an earlier day', () => {
  it('names the day, its week and its month by their dates', async () => {
    const gateway = fakeGateway([
      {
        entries: [entry('2026-08-21'), entry('2026-08-05', 7200), entry('2026-08-03', 3600)],
        nextCursor: null,
      },
    ])

    renderRoutedReport(asOf(isoDate('2026-08-05')), { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(figure('Aug 5').getByRole('definition')).toHaveTextContent('2')
    })
    expect(figure('Week of Aug 3').getByRole('definition')).toHaveTextContent('3')
    expect(figure('This month').getByRole('definition')).toHaveTextContent('4')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('August 5, 2026')
  })

  it('names a month that is not the current one by its name', async () => {
    renderRoutedReport(asOf(isoDate('2026-07-15')), { storage: inUtc() })

    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'July 2026' })).toBeInTheDocument()
    })
  })

  it('draws the week of the chosen day, with no day in it marked as today', async () => {
    renderRoutedReport(asOf(isoDate('2026-08-05')), { storage: inUtc() })

    const strip = await screen.findByRole('region', { name: 'Week of Aug 3' })

    await waitFor(() => {
      expect(within(strip).getAllByRole('button')).toHaveLength(7)
    })
    expect(within(strip).queryByRole('button', { current: 'date' })).not.toBeInTheDocument()
  })

  it('reads history back until the chosen day is answered', async () => {
    const gateway = fakeGateway([
      { entries: [entry('2026-08-21')], nextCursor: 'a' },
      { entries: [entry('2026-07-20')], nextCursor: 'b' },
      { entries: [entry('2026-07-15', 7200)], nextCursor: 'c' },
      { entries: [entry('2026-06-28')], nextCursor: null },
    ])

    renderRoutedReport(asOf(isoDate('2026-07-15')), { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(figure('July 2026').getByRole('definition')).toHaveTextContent('3')
    })
    expect(figure('Jul 15').getByRole('definition')).toHaveTextContent('2')
    expect(gateway.myTimelogs).toHaveBeenCalledTimes(4)
  })

  it('shows the week as loading rather than empty until it is reached', async () => {
    const { gateway, held } = heldGateway({ entries: [entry('2026-08-21')], nextCursor: 'a' })

    renderRoutedReport(asOf(isoDate('2026-07-15')), { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(gateway.myTimelogs).toHaveBeenCalledTimes(2)
    })
    const strip = screen.getByRole('region', { name: 'Week of Jul 13' })

    expect(within(strip).queryAllByRole('button')).toHaveLength(0)
    held.release({ entries: [entry('2026-06-28')], nextCursor: null })

    await waitFor(() => {
      expect(within(strip).getAllByRole('button')).toHaveLength(7)
    })
  })

  it('begins the feed at the chosen day', async () => {
    const gateway = fakeGateway([
      { entries: [entry('2026-08-21'), entry('2026-08-19', 7200)], nextCursor: null },
    ])

    renderRoutedReport(asOf(isoDate('2026-08-20')), { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(
        within(screen.getByRole('region', { name: 'History' })).getAllByRole('button', {
          expanded: false,
        }),
      ).toHaveLength(1)
    })
    expect(
      within(screen.getByRole('region', { name: 'History' })).getByRole('button', {
        expanded: false,
      }),
    ).toHaveTextContent('19')
  })

  it('says nothing was logged up to the chosen day, not that nothing was logged at all', async () => {
    const gateway = fakeGateway([{ entries: [entry('2026-08-21')], nextCursor: null }])

    renderRoutedReport(asOf(isoDate('2026-08-10')), { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(screen.getByText(/nothing logged on or before this day/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/no time logged in gitlab yet/i)).not.toBeInTheDocument()
  })

  it('reads a day after today as today', async () => {
    renderRoutedReport(asOf(isoDate('2026-09-01')), { storage: inUtc() })

    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Today' })).toBeInTheDocument()
    })
  })
})

describe('the day control', () => {
  it('steps back one day', async () => {
    const onChoose = vi.fn()

    renderReport(asOf(isoDate('2026-08-20'), onChoose), { storage: inUtc() })
    await userEvent.click(screen.getByRole('button', { name: 'Previous day' }))

    expect(onChoose).toHaveBeenCalledWith('2026-08-19')
  })

  it('steps forward onto today as the address that names no day', async () => {
    const onChoose = vi.fn()

    renderReport(asOf(isoDate('2026-08-20'), onChoose), { storage: inUtc() })
    await userEvent.click(screen.getByRole('button', { name: 'Next day' }))

    expect(onChoose).toHaveBeenCalledWith(null)
  })

  it('goes back to today in one press', async () => {
    const onChoose = vi.fn()

    renderReport(asOf(isoDate('2026-07-02'), onChoose), { storage: inUtc() })
    await userEvent.click(screen.getByRole('button', { name: 'Back to today' }))

    expect(onChoose).toHaveBeenCalledWith(null)
  })

  it('offers nothing after today, and keeps those controls focusable', async () => {
    const onChoose = vi.fn()

    renderReport(asOf(null, onChoose), { storage: inUtc() })
    const next = screen.getByRole('button', { name: 'Next day' })

    expect(next).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Back to today' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await userEvent.click(next)

    expect(onChoose).not.toHaveBeenCalled()
  })
})

describe('the day picker', () => {
  it('names the day on screen in the app language, with its year', async () => {
    renderReport(asOf(isoDate('2025-11-04')), { storage: inUtc() })

    expect(await screen.findByRole('button', { name: /^Day shown: / })).toHaveTextContent(
      'Nov 4, 2025',
    )
  })

  it('opens on the month of the day on screen, with that day marked', async () => {
    renderReport(asOf(isoDate('2026-07-15')), { storage: inUtc() })

    await userEvent.click(await screen.findByRole('button', { name: /^Day shown: / }))

    const month = await screen.findByRole('grid', { name: 'July 2026' })

    expect(
      within(month).getByRole('button', { name: 'Wednesday, July 15, 2026, the day shown' }),
    ).toBeInTheDocument()
  })

  it('moves to the day the reader picks, and closes', async () => {
    const onChoose = vi.fn()

    renderReport(asOf(isoDate('2026-08-20'), onChoose), { storage: inUtc() })
    await userEvent.click(await screen.findByRole('button', { name: /^Day shown: / }))
    await userEvent.click(await screen.findByRole('button', { name: 'Wednesday, August 12, 2026' }))

    expect(onChoose).toHaveBeenCalledWith('2026-08-12')
    await waitFor(() => {
      expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    })
  })

  it('reads today, picked, as the address that names no day', async () => {
    const onChoose = vi.fn()

    renderReport(asOf(isoDate('2026-08-20'), onChoose), { storage: inUtc() })
    await userEvent.click(await screen.findByRole('button', { name: /^Day shown: / }))
    await userEvent.click(
      await screen.findByRole('button', { name: 'Friday, August 21, 2026, Today' }),
    )

    expect(onChoose).toHaveBeenCalledWith(null)
  })

  it('cannot pick a day after today, nor page past this month', async () => {
    renderReport(asOf(null), { storage: inUtc() })

    await userEvent.click(await screen.findByRole('button', { name: /^Day shown: / }))

    expect(await screen.findByRole('button', { name: 'Saturday, August 22, 2026' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next month' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('pages back to an earlier month', async () => {
    renderReport(asOf(null), { storage: inUtc() })

    await userEvent.click(await screen.findByRole('button', { name: /^Day shown: / }))
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))

    expect(await screen.findByRole('grid', { name: 'July 2026' })).toBeInTheDocument()
  })

  it('follows the day when it is moved by something other than the picker', async () => {
    const { rerender } = renderReport(asOf(isoDate('2026-08-20')), { storage: inUtc() })

    await screen.findByRole('button', { name: /^Day shown: / })
    rerender(asOf(isoDate('2026-08-12')))

    expect(screen.getByRole('button', { name: /^Day shown: / })).toHaveTextContent('Aug 12, 2026')
  })
})
