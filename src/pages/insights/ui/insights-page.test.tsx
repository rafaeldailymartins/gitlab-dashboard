import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeGateway, renderReport } from '~tests/support/report'

import type { TimelogEntry } from '@/entities/timelogs'

import { memoryStorage } from '@/shared/lib/storage'

import { InsightsPage } from './insights-page'

/** A Saturday. August 2026 starts on a Saturday and holds 21 weekdays. */
const NOW = new Date('2026-08-22T15:00:00Z')

/** The address naming no month, which is the current one. */
const THIS_MONTH = { chosen: null, onChoose: vi.fn() }

const FISCAL = {
  fullPath: 'invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
  name: 'inventariofiscal',
  webUrl: 'https://gitlab.com/invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
}

const WEB = {
  fullPath: 'invent-software/web',
  name: 'web',
  webUrl: 'https://gitlab.com/invent-software/web',
}

interface EntrySpec {
  readonly day: string
  readonly hours: number
  readonly iid: null | number
  readonly project?: null | typeof FISCAL
}

function entry({ day, hours, iid, project = FISCAL }: EntrySpec): TimelogEntry {
  return {
    project,
    seconds: hours * 3600,
    spentAt: new Date(`${day}T15:00:00Z`),
    summary: null,
    workItem:
      iid === null || project === null
        ? null
        : {
            kind: 'issue',
            reference: `${project.fullPath}#${String(iid)}`,
            title: `Issue ${String(iid)}`,
            webUrl: `${project.webUrl}/-/work_items/${String(iid)}`,
          },
  }
}

function gatewayWith(entries: TimelogEntry[]) {
  return fakeGateway([{ entries, nextCursor: null }])
}

function inUtc() {
  const storage = memoryStorage()
  storage.write('preferences', JSON.stringify({ timeZone: 'UTC' }))

  return storage
}

function section(name: RegExp) {
  return within(screen.getByRole('region', { name }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('InsightsPage', () => {
  it('names the month it is showing, and what was logged in it', async () => {
    const gateway = gatewayWith([entry({ day: '2026-08-20', hours: 6.7, iid: 128 })])

    renderReport(<InsightsPage {...THIS_MONTH} />, { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(screen.getByText(/6\.7 h logged this month/)).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('August 2026')
  })

  it('tells a day with time from a working day without it', async () => {
    const gateway = gatewayWith([entry({ day: '2026-08-20', hours: 6.7, iid: 128 })])

    renderReport(<InsightsPage {...THIS_MONTH} />, { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(screen.getByText(/August 20, 2026: 6\.7 hours/)).toBeInTheDocument()
    })
    // The 19th is a working day the reader logged nothing on.
    expect(
      screen.getByText(/August 19, 2026: 0 hours — a working day with nothing logged/),
    ).toBeInTheDocument()
  })

  it('says nothing of the sort about a weekend with nothing logged', async () => {
    const gateway = gatewayWith([entry({ day: '2026-08-20', hours: 6.7, iid: 128 })])

    renderReport(<InsightsPage {...THIS_MONTH} />, { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(screen.getByText(/^Sunday, August 23, 2026: 0 hours$/)).toBeInTheDocument()
    })
  })

  it('leaves the days of another month out of the grid', async () => {
    const gateway = gatewayWith([entry({ day: '2026-07-20', hours: 8, iid: 128 })])

    renderReport(<InsightsPage {...THIS_MONTH} />, { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    })
    expect(screen.queryByText(/July 20, 2026/)).not.toBeInTheDocument()
  })

  it('splits the month by project, busiest first', async () => {
    const gateway = gatewayWith([
      entry({ day: '2026-08-20', hours: 2, iid: 128 }),
      entry({ day: '2026-08-19', hours: 6, iid: 34, project: WEB }),
    ])

    renderReport(<InsightsPage {...THIS_MONTH} />, { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(section(/Hours by project/).getAllByRole('listitem')).toHaveLength(2)
    })
    const rows = section(/Hours by project/).getAllByRole('listitem')

    expect(rows.at(0)).toHaveTextContent('web')
    expect(rows.at(1)).toHaveTextContent('inventariofiscal')
  })

  it('splits exactly the hours the month holds', async () => {
    const gateway = gatewayWith([
      entry({ day: '2026-08-20', hours: 2, iid: 128 }),
      entry({ day: '2026-08-19', hours: 6, iid: 34, project: WEB }),
    ])

    renderReport(<InsightsPage {...THIS_MONTH} />, { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(section(/Hours by project/).getByText('6 hours')).toBeInTheDocument()
    })
    expect(section(/Hours by project/).getByText('2 hours')).toBeInTheDocument()
    expect(screen.getByText(/8 h logged this month/)).toBeInTheDocument()
  })

  it('lists the busiest work item first, without being asked', async () => {
    const gateway = gatewayWith([
      entry({ day: '2026-08-20', hours: 2, iid: 127 }),
      entry({ day: '2026-08-19', hours: 6, iid: 128 }),
    ])

    renderReport(<InsightsPage {...THIS_MONTH} />, { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(section(/What took the time/).getAllByRole('row')).toHaveLength(3)
    })
    const rows = section(/What took the time/).getAllByRole('row')

    expect(rows.at(1)).toHaveTextContent('Issue 128')
    expect(rows.at(2)).toHaveTextContent('Issue 127')
  })

  it('sorts by work item when the reader asks for that column instead', async () => {
    const gateway = gatewayWith([
      entry({ day: '2026-08-20', hours: 6, iid: 128 }),
      entry({ day: '2026-08-19', hours: 2, iid: 127 }),
    ])

    renderReport(<InsightsPage {...THIS_MONTH} />, { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(
        section(/What took the time/).getByRole('button', { name: /Item/ }),
      ).toBeInTheDocument()
    })
    await userEvent.click(section(/What took the time/).getByRole('button', { name: /Item/ }))

    // Alphabetical by title now, so 127 leads even though 128 holds more hours.
    expect(
      section(/What took the time/)
        .getAllByRole('row')
        .at(1),
    ).toHaveTextContent('Issue 127')
  })

  it('reverses the order when the reader sorts the other way', async () => {
    const gateway = gatewayWith([
      entry({ day: '2026-08-20', hours: 2, iid: 127 }),
      entry({ day: '2026-08-19', hours: 6, iid: 128 }),
    ])

    renderReport(<InsightsPage {...THIS_MONTH} />, { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(
        section(/What took the time/).getByRole('button', { name: /Hours/ }),
      ).toBeInTheDocument()
    })
    await userEvent.click(section(/What took the time/).getByRole('button', { name: /Hours/ }))

    expect(
      section(/What took the time/)
        .getAllByRole('row')
        .at(1),
    ).toHaveTextContent('Issue 127')
  })

  it('counts the days an item kept coming back', async () => {
    const gateway = gatewayWith([
      entry({ day: '2026-08-20', hours: 2, iid: 128 }),
      entry({ day: '2026-08-19', hours: 6, iid: 128 }),
    ])

    renderReport(<InsightsPage {...THIS_MONTH} />, { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(section(/What took the time/).getAllByRole('row')).toHaveLength(2)
    })
    expect(
      section(/What took the time/)
        .getAllByRole('row')
        .at(1),
    ).toHaveTextContent('2')
  })

  it('links a work item back to GitLab', async () => {
    const gateway = gatewayWith([entry({ day: '2026-08-20', hours: 2, iid: 128 })])

    renderReport(<InsightsPage {...THIS_MONTH} />, { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(
        section(/What took the time/).getByRole('link', { name: /Issue 128/ }),
      ).toHaveAttribute('href', `${FISCAL.webUrl}/-/work_items/128`)
    })
  })

  it('shows unattributed time as its own row', async () => {
    const gateway = gatewayWith([entry({ day: '2026-08-20', hours: 2, iid: null })])

    renderReport(<InsightsPage {...THIS_MONTH} />, { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(
        section(/What took the time/).getByText(/No issue or merge request/),
      ).toBeInTheDocument()
    })
  })

  it('sorts an unattributed row by the words a reader sees on it', async () => {
    const gateway = gatewayWith([
      entry({ day: '2026-08-20', hours: 6, iid: null }),
      entry({ day: '2026-08-19', hours: 2, iid: 128 }),
    ])

    renderReport(<InsightsPage {...THIS_MONTH} />, { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(
        section(/What took the time/).getByRole('button', { name: /Item/ }),
      ).toBeInTheDocument()
    })
    await userEvent.click(section(/What took the time/).getByRole('button', { name: /Item/ }))

    // "Issue 128" before "No issue or merge request": the unattributed row is
    // ordered by its own label, not left at whatever position it happened to be.
    expect(
      section(/What took the time/)
        .getAllByRole('row')
        .at(1),
    ).toHaveTextContent('Issue 128')
  })

  it('says a month with nothing logged is empty rather than showing blank frames', async () => {
    const gateway = gatewayWith([entry({ day: '2026-07-20', hours: 8, iid: 128 })])

    renderReport(<InsightsPage {...THIS_MONTH} />, { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(screen.getAllByText(/Nothing logged in this month/)).toHaveLength(2)
    })
  })

  it('waits rather than claiming an empty month before anything has loaded', () => {
    renderReport(<InsightsPage {...THIS_MONTH} />, { storage: inUtc() })

    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('folds the projects past the sixth into one row, rather than reusing a colour', async () => {
    const projects = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name) => ({
      fullPath: `group/${name}`,
      name,
      webUrl: `https://gitlab.example/${name}`,
    }))
    const gateway = gatewayWith(
      projects.map((project, index) =>
        entry({ day: '2026-08-20', hours: 7 - index, iid: 100 + index, project }),
      ),
    )

    renderReport(<InsightsPage {...THIS_MONTH} />, { gateway, storage: inUtc() })

    await waitFor(() => {
      expect(section(/Hours by project/).getByText(/1 other projects/)).toBeInTheDocument()
    })
    // Six named rows plus the folded one, never a seventh colour.
    expect(section(/Hours by project/).getAllByRole('listitem')).toHaveLength(7)
  })
})

describe('a project the reader cannot read', () => {
  const withheld = { day: '2026-08-20', hours: 2, iid: null, project: null }

  it('is named as one group in the split by project', async () => {
    renderReport(<InsightsPage {...THIS_MONTH} />, {
      gateway: gatewayWith([entry(withheld), entry({ ...withheld, hours: 1 })]),
      storage: inUtc(),
    })

    await waitFor(() => {
      expect(section(/hours by project/i).getByText(/no project reported/i)).toBeInTheDocument()
    })
    expect(section(/hours by project/i).getAllByRole('listitem')).toHaveLength(1)
  })

  it('is named in the table of what took the time', async () => {
    renderReport(<InsightsPage {...THIS_MONTH} />, {
      gateway: gatewayWith([entry(withheld)]),
      storage: inUtc(),
    })

    await waitFor(() => {
      expect(section(/what took the time/i).getByText(/no project reported/i)).toBeInTheDocument()
    })
  })
})
