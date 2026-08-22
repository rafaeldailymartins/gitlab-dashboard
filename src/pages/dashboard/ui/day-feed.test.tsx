import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderReport } from '~tests/support/report'

import type { DayTotal, WorkItemTotal } from '@/entities/timelogs'

import { isoDate } from '@/shared/lib/date'

import { DayFeed } from './day-feed'

const SECONDS_PER_HOUR = 3600

const PROJECT = {
  fullPath: 'invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
  name: 'invent.fiscal.inventariofiscal',
  webUrl: 'https://gitlab.com/invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
}

function day(date: string, items: WorkItemTotal[]): DayTotal {
  const seconds = items.reduce((total, entry) => total + entry.seconds, 0)

  return {
    date: isoDate(date),
    entryCount: items.length,
    hours: seconds / SECONDS_PER_HOUR,
    items,
    seconds,
  }
}

function feed(days: DayTotal[], overrides: Partial<Parameters<typeof DayFeed>[0]> = {}) {
  return (
    <DayFeed
      appending={false}
      days={days}
      loading={false}
      onLoadOlder={vi.fn()}
      reachedBeginning
      {...overrides}
    />
  )
}

function item(hours: number, reference: null | string): WorkItemTotal {
  return {
    entryCount: 1,
    hours,
    project: PROJECT,
    seconds: hours * SECONDS_PER_HOUR,
    workItem:
      reference === null
        ? null
        : {
            kind: 'issue',
            reference,
            title: `Work on ${reference}`,
            webUrl: `https://gitlab.com/${reference.replace('#', '/-/work_items/')}`,
          },
  }
}

const AUGUST_20 = day('2026-08-20', [item(6.7, `${PROJECT.fullPath}#128`)])

describe('DayFeed', () => {
  it('lists the days it was given, newest first, as they arrived', () => {
    renderReport(feed([AUGUST_20, day('2026-08-19', [item(2, null)])]))

    const rows = screen.getAllByRole('button')

    expect(rows.at(0)).toHaveTextContent('20')
    expect(rows.at(1)).toHaveTextContent('19')
  })

  it('shows each day total, spoken with its unit', () => {
    renderReport(feed([AUGUST_20]))

    expect(screen.getByLabelText('6.7 hours')).toBeInTheDocument()
  })

  it('keeps a day closed until it is asked to open', () => {
    renderReport(feed([AUGUST_20]))

    expect(screen.queryByText(/Work on/)).not.toBeInTheDocument()
  })

  it('opens a day into what was worked on', async () => {
    renderReport(feed([AUGUST_20]))

    await userEvent.click(screen.getByRole('button'))

    expect(screen.getByRole('link', { name: /Work on/ })).toBeInTheDocument()
  })

  it('links a work item to GitLab, in a new tab', async () => {
    renderReport(feed([AUGUST_20]))

    await userEvent.click(screen.getByRole('button'))

    expect(screen.getByRole('link', { name: /Work on/ })).toHaveAttribute(
      'href',
      `https://gitlab.com/${PROJECT.fullPath}/-/work_items/128`,
    )
    expect(screen.getByRole('link', { name: /Work on/ })).toHaveAttribute('target', '_blank')
  })

  it('lists work items whose hours sum to the day total', async () => {
    const mixed = day('2026-08-20', [
      item(4, `${PROJECT.fullPath}#128`),
      item(2.7, `${PROJECT.fullPath}#127`),
    ])
    renderReport(feed([mixed]))

    await userEvent.click(screen.getByRole('button', { name: /6.7 hours/ }))
    const rows = within(screen.getByRole('list')).getAllByRole('listitem')

    expect(rows).toHaveLength(2)
    expect(rows.at(0)).toHaveTextContent('4')
    expect(rows.at(1)).toHaveTextContent('2.7')
  })

  it('shows time with no issue as unattributed, naming its project', async () => {
    renderReport(feed([day('2026-08-20', [item(1, null)])]))

    await userEvent.click(screen.getByRole('button'))

    expect(screen.getByText(/No issue or merge request/)).toBeInTheDocument()
    expect(screen.getByText(PROJECT.fullPath)).toBeInTheDocument()
  })

  it('says the history is complete rather than offering more', () => {
    renderReport(feed([AUGUST_20]))

    expect(screen.getByText(/whole history/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /older/i })).not.toBeInTheDocument()
  })

  it('offers older days while there are older days', () => {
    renderReport(feed([AUGUST_20], { reachedBeginning: false }))

    expect(screen.getByRole('button', { name: /Load older days/i })).toBeInTheDocument()
  })

  it('asks for older days when the reader says so', async () => {
    const onLoadOlder = vi.fn()
    renderReport(feed([AUGUST_20], { onLoadOlder, reachedBeginning: false }))

    await userEvent.click(screen.getByRole('button', { name: /Load older days/i }))

    expect(onLoadOlder).toHaveBeenCalledTimes(1)
  })

  it('says it is loading, and asks for nothing more, while a page is on its way', () => {
    renderReport(feed([AUGUST_20], { appending: true, reachedBeginning: false }))

    expect(screen.getByRole('button', { name: /Loading older days/i })).toBeDisabled()
  })

  it('appends to what is already there rather than replacing it', () => {
    const { rerender } = renderReport(feed([AUGUST_20], { reachedBeginning: false }))

    rerender(feed([AUGUST_20, day('2026-08-19', [item(2, null)])], { reachedBeginning: false }))

    const rows = screen.getAllByRole('button', { expanded: false })

    expect(rows.at(0)).toHaveTextContent('20')
    expect(rows.at(1)).toHaveTextContent('19')
  })

  it('draws skeletons, not an empty state, before anything has loaded', () => {
    renderReport(feed([], { loading: true }))

    expect(screen.queryByText(/No time logged/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/whole history/i)).not.toBeInTheDocument()
  })

  it('says plainly when there is nothing to show, which is not the same thing', () => {
    renderReport(feed([]))

    expect(screen.getByText(/No time logged in GitLab yet/i)).toBeInTheDocument()
  })
  it('fills the whole track on a day with no target but logged time', () => {
    renderReport(feed([day('2026-08-22', [item(3, null)])]))

    expect(screen.getByLabelText('3 hours')).toBeInTheDocument()
  })

  it('draws no bar on a day with no target and no time', () => {
    renderReport(feed([day('2026-08-22', [])]))

    expect(screen.getByLabelText('0 hours')).toBeInTheDocument()
  })
})
