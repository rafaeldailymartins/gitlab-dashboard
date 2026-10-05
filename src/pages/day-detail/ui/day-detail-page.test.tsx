import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeGateway, renderRoutedReport } from '~tests/support/report'

import type { TimelogEntry } from '@/entities/timelogs'

import { isoDate } from '@/shared/lib/date'

import { DayDetailPage } from './day-detail-page'

const NOW = new Date('2026-08-21T15:00:00Z')

const PROJECT = {
  fullPath: 'invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
  name: 'invent.fiscal.inventariofiscal',
  webUrl: 'https://gitlab.com/invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
}

function entry(day: string, seconds: number, iid: null | number): TimelogEntry {
  return {
    project: PROJECT,
    seconds,
    spentAt: new Date(`${day}T15:00:00Z`),
    summary: null,
    workItem:
      iid === null
        ? null
        : {
            kind: 'issue',
            reference: `${PROJECT.fullPath}#${String(iid)}`,
            title: `Issue ${String(iid)}`,
            webUrl: `${PROJECT.webUrl}/-/work_items/${String(iid)}`,
          },
  }
}

/** The same entry as GitLab returns one whose project it will not resolve. */
function withoutProject(source: TimelogEntry): TimelogEntry {
  return { ...source, project: null }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('DayDetailPage', () => {
  it('names the day it is showing', async () => {
    renderRoutedReport(<DayDetailPage date={isoDate('2026-08-20')} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('August 20, 2026')
    })
  })

  it('totals only that day, against that day target', async () => {
    const gateway = fakeGateway([
      {
        entries: [entry('2026-08-20', 24_120, 128), entry('2026-08-19', 3600, 127)],
        nextCursor: null,
      },
    ])

    renderRoutedReport(<DayDetailPage date={isoDate('2026-08-20')} />, { gateway })

    await waitFor(() => {
      expect(screen.getByText('6.7 hours')).toBeInTheDocument()
    })
    expect(screen.getByText(/of 8 h/)).toBeInTheDocument()
  })

  it('lists what the day went into, busiest first', async () => {
    const gateway = fakeGateway([
      {
        entries: [entry('2026-08-20', 3600, 127), entry('2026-08-20', 24_120, 128)],
        nextCursor: null,
      },
    ])

    renderRoutedReport(<DayDetailPage date={isoDate('2026-08-20')} />, { gateway })

    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(2)
    })
    expect(screen.getAllByRole('listitem').at(0)).toHaveTextContent('Issue 128')
  })

  it('links a work item back to GitLab', async () => {
    const gateway = fakeGateway([{ entries: [entry('2026-08-20', 24_120, 128)], nextCursor: null }])

    renderRoutedReport(<DayDetailPage date={isoDate('2026-08-20')} />, { gateway })

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Issue 128/ })).toHaveAttribute(
        'href',
        `${PROJECT.webUrl}/-/work_items/128`,
      )
    })
  })

  it('shows unattributed time with the project it belongs to', async () => {
    const gateway = fakeGateway([{ entries: [entry('2026-08-20', 3600, null)], nextCursor: null }])

    renderRoutedReport(<DayDetailPage date={isoDate('2026-08-20')} />, { gateway })

    await waitFor(() => {
      expect(screen.getByText(/No issue or merge request/)).toBeInTheDocument()
    })
    expect(screen.getByText(PROJECT.fullPath)).toBeInTheDocument()
  })

  it('answers a day with nothing logged, rather than showing an empty frame', async () => {
    const gateway = fakeGateway([{ entries: [entry('2026-08-19', 3600, 127)], nextCursor: null }])

    renderRoutedReport(<DayDetailPage date={isoDate('2026-08-20')} />, { gateway })

    await waitFor(() => {
      expect(screen.getByText(/No time logged on this day/i)).toBeInTheDocument()
    })
    expect(screen.getByText('0 hours')).toBeInTheDocument()
  })

  it('reads history back to a day older than the first page', async () => {
    const gateway = fakeGateway([
      { entries: [entry('2026-08-20', 3600, 128)], nextCursor: 'older' },
      { entries: [entry('2026-07-10', 7200, 127)], nextCursor: 'older-still' },
      { entries: [entry('2026-06-29', 3600, 126)], nextCursor: null },
    ])

    renderRoutedReport(<DayDetailPage date={isoDate('2026-07-10')} />, { gateway })

    await waitFor(() => {
      expect(screen.getByText('2 hours')).toBeInTheDocument()
    })
    expect(gateway.myTimelogs).toHaveBeenCalledTimes(3)
  })

  it('shows an old day as loading, not as empty, until it is read', async () => {
    const gateway = {
      myTimelogs: vi
        .fn()
        .mockResolvedValueOnce({ entries: [entry('2026-08-20', 3600, 128)], nextCursor: 'older' })
        .mockReturnValueOnce(
          new Promise(() => {
            // Never answers: the day stays unread.
          }),
        ),
    }

    renderRoutedReport(<DayDetailPage date={isoDate('2026-07-10')} />, { gateway })

    await waitFor(() => {
      expect(gateway.myTimelogs).toHaveBeenCalledTimes(2)
    })
    expect(screen.queryByText(/No time logged on this day/i)).not.toBeInTheDocument()
    expect(screen.queryByText('0 hours')).not.toBeInTheDocument()
  })

  it('offers the way back to the dashboard', async () => {
    renderRoutedReport(<DayDetailPage date={isoDate('2026-08-20')} />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Back to the dashboard/i })).toHaveAttribute(
        'href',
        '/',
      )
    })
  })
  it('says a day with no target has none, rather than inventing one', async () => {
    // A Saturday, which the default schedule gives no hours.
    renderRoutedReport(<DayDetailPage date={isoDate('2026-08-22')} />)

    await waitFor(() => {
      expect(screen.getByText(/no target/i)).toBeInTheDocument()
    })
  })
})

describe('a day holding an entry whose project could not be read', () => {
  it('names the missing project rather than leaving the place blank', async () => {
    const gateway = fakeGateway([
      { entries: [withoutProject(entry('2026-08-20', 3600, null))], nextCursor: null },
    ])

    renderRoutedReport(<DayDetailPage date={isoDate('2026-08-20')} />, { gateway })

    await waitFor(() => {
      expect(screen.getByText(/no project reported/i)).toBeInTheDocument()
    })
  })
})
