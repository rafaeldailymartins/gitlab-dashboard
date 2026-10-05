import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeGateway, renderReport } from '~tests/support/report'

import type { TimelogEntry, TimelogPage } from '@/entities/timelogs'

import { isoDate, type IsoDate } from '@/shared/lib/date'
import { memoryStorage } from '@/shared/lib/storage'

import { InsightsPage } from './insights-page'

/** A Saturday in August 2026, so July is the month before. */
const NOW = new Date('2026-08-22T15:00:00Z')

const WEB = {
  fullPath: 'invent-software/web',
  name: 'web',
  webUrl: 'https://gitlab.com/invent-software/web',
}

function entry(day: string, hours = 1): TimelogEntry {
  return {
    project: WEB,
    seconds: hours * 3600,
    spentAt: new Date(`${day}T12:00:00Z`),
    summary: null,
    workItem: null,
  }
}

function inUtc() {
  const storage = memoryStorage()
  storage.write('preferences', JSON.stringify({ timeZone: 'UTC' }))

  return storage
}

function showing(chosen: IsoDate | null, onChoose = vi.fn()) {
  return <InsightsPage chosen={chosen} onChoose={onChoose} />
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('insights for an earlier month', () => {
  it('names the month and what was logged in it', async () => {
    const gateway = fakeGateway([
      { entries: [entry('2026-08-20', 5), entry('2026-07-14', 2)], nextCursor: null },
    ])

    renderReport(showing(isoDate('2026-07-01')), { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(screen.getByText(/2 h logged that month/)).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('July 2026')
    expect(screen.getByText(/July 14, 2026: 2 hours/)).toBeInTheDocument()
    expect(screen.queryByText(/August 20, 2026/)).not.toBeInTheDocument()
  })

  it('reads history back until the month is answered', async () => {
    const gateway = fakeGateway([
      { entries: [entry('2026-08-20')], nextCursor: 'a' },
      { entries: [entry('2026-07-10', 3)], nextCursor: 'b' },
      { entries: [entry('2026-06-20')], nextCursor: null },
    ])

    renderReport(showing(isoDate('2026-07-01')), { gateway, storage: inUtc() })

    const split = await screen.findByRole('region', { name: /hours by project/i })

    expect(within(split).getByText('3 hours')).toBeInTheDocument()
    expect(gateway.myTimelogs).toHaveBeenCalledTimes(3)
  })

  it('waits rather than drawing unread days as days with nothing logged', async () => {
    const held = { release: (_page: TimelogPage): void => undefined }
    const gateway = {
      myTimelogs: vi
        .fn()
        .mockResolvedValueOnce({ entries: [entry('2026-08-20')], nextCursor: 'a' })
        .mockReturnValueOnce(
          new Promise<TimelogPage>((resolve) => {
            held.release = resolve
          }),
        ),
    }

    renderReport(showing(isoDate('2026-07-01')), { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(gateway.myTimelogs).toHaveBeenCalledTimes(2)
    })
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(screen.queryByText(/logged that month/)).not.toBeInTheDocument()
    held.release({ entries: [entry('2026-06-20')], nextCursor: null })

    expect(await screen.findByText(/0 h logged that month/)).toBeInTheDocument()
  })

  it('reads a month after the current one as the current one', async () => {
    renderReport(showing(isoDate('2026-10-01')), { storage: inUtc() })

    await waitFor(() => {
      expect(screen.getByText(/logged this month/)).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('August 2026')
  })
})

describe('the month control', () => {
  it('steps back one month', async () => {
    const onChoose = vi.fn()

    renderReport(showing(null, onChoose), { storage: inUtc() })
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))

    expect(onChoose).toHaveBeenCalledWith('2026-07-01')
  })

  it('steps back across a year', async () => {
    const onChoose = vi.fn()

    renderReport(showing(isoDate('2026-01-01'), onChoose), { storage: inUtc() })
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))

    expect(onChoose).toHaveBeenCalledWith('2025-12-01')
  })

  it('steps forward onto the current month as the address that names none', async () => {
    const onChoose = vi.fn()

    renderReport(showing(isoDate('2026-07-01'), onChoose), { storage: inUtc() })
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }))

    expect(onChoose).toHaveBeenCalledWith(null)
  })

  it('steps forward to a month that is still in the past', async () => {
    const onChoose = vi.fn()

    renderReport(showing(isoDate('2026-05-01'), onChoose), { storage: inUtc() })
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }))

    expect(onChoose).toHaveBeenCalledWith('2026-06-01')
  })

  it('goes back to the current month in one press', async () => {
    const onChoose = vi.fn()

    renderReport(showing(isoDate('2025-11-01'), onChoose), { storage: inUtc() })
    await userEvent.click(screen.getByRole('button', { name: 'Back to the current month' }))

    expect(onChoose).toHaveBeenCalledWith(null)
  })

  it('offers nothing after the current month', async () => {
    const onChoose = vi.fn()

    renderReport(showing(null, onChoose), { storage: inUtc() })
    const next = screen.getByRole('button', { name: 'Next month' })

    expect(next).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Back to the current month' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await userEvent.click(next)

    expect(onChoose).not.toHaveBeenCalled()
  })
})
