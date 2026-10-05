import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderReport } from '~tests/support/report'

import type { HoursReport } from '../lib/use-hours-report'

import { withheldNotices } from '../lib/notices'
import { SyncControl } from './sync-control'

/** 15:00 UTC is midday in São Paulo, which is the default zone preference. */
const NOW = new Date('2026-08-21T15:00:00Z')

const YESTERDAY = new Date('2026-08-20T15:00:00Z')

const NOTHING = { entryCount: 0, hours: 0, seconds: 0, settled: true }

const SYNC = /sync with gitlab/i

function reportWith(overrides: Partial<HoursReport> = {}): HoursReport {
  return {
    appending: false,
    complete: true,
    day: NOTHING,
    days: [],
    failure: null,
    hasFigures: true,
    loadOlder: vi.fn(),
    month: NOTHING,
    sync: vi.fn(),
    syncedAt: NOW,
    syncing: false,

    unread: 0,
    week: NOTHING,
    withoutProject: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SyncControl', () => {
  it('names the clock time the hours arrived, when that was today', () => {
    renderReport(<SyncControl notices={withheldNotices(reportWith())} status={reportWith()} />)

    expect(screen.getByRole('status')).toHaveTextContent(/updated at 12:00/i)
  })

  it('names the date as well, when the hours arrived on an earlier day', () => {
    renderReport(
      <SyncControl
        notices={withheldNotices(reportWith({ syncedAt: YESTERDAY }))}
        status={reportWith({ syncedAt: YESTERDAY })}
      />,
    )

    // The date is what a reader needs to know the figures are a day old; the
    // time alone would read as if they had just arrived.
    expect(screen.getByRole('status')).toHaveTextContent(/aug/i)
    expect(screen.getByRole('status')).toHaveTextContent(/20/)
  })

  it('reads the day in the reader time zone rather than in UTC', () => {
    // 02:00 UTC on the 21st is 23:00 on the 20th in São Paulo, so a sync then
    // is yesterday's — and would be called today by a UTC clock.
    const syncedAt = new Date('2026-08-21T02:00:00Z')

    renderReport(
      <SyncControl
        notices={withheldNotices(reportWith({ syncedAt }))}
        status={reportWith({ syncedAt })}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/20/)
  })

  it('says so when nothing has arrived from GitLab yet', () => {
    renderReport(
      <SyncControl
        notices={withheldNotices(reportWith({ syncedAt: null }))}
        status={reportWith({ syncedAt: null })}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/not synced yet/i)
  })

  it('says the hours are being updated while a request is in flight', () => {
    renderReport(
      <SyncControl
        notices={withheldNotices(reportWith({ syncing: true }))}
        status={reportWith({ syncing: true })}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/updating/i)
  })

  it('reports a failure in place of the time, and stays pressable', () => {
    const failure = { kind: 'unauthorized' } as const

    renderReport(
      <SyncControl
        notices={withheldNotices(reportWith({ failure }))}
        status={reportWith({ failure })}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/no longer accepts/i)
    expect(screen.getByRole('button', { name: SYNC })).toBeEnabled()
  })

  it.each([
    { failure: { kind: 'unavailable' }, says: /could not be reached/i },
    { failure: { kind: 'rejected', messages: ['No such field'] }, says: /refused the request/i },
  ] as const)('explains a $failure.kind failure', ({ failure, says }) => {
    renderReport(
      <SyncControl
        notices={withheldNotices(reportWith({ failure }))}
        status={reportWith({ failure })}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(says)
  })

  it('asks for the hours again when pressed', async () => {
    const sync = vi.fn()

    renderReport(
      <SyncControl notices={withheldNotices(reportWith({ sync }))} status={reportWith({ sync })} />,
    )
    await userEvent.click(screen.getByRole('button', { name: SYNC }))

    expect(sync).toHaveBeenCalledTimes(1)
  })

  it('stays pressable while a request is in flight, so focus is never taken away', async () => {
    const sync = vi.fn()

    renderReport(
      <SyncControl
        notices={withheldNotices(reportWith({ sync, syncing: true }))}
        status={reportWith({ sync, syncing: true })}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: SYNC }))

    expect(sync).toHaveBeenCalledTimes(1)
  })
})

describe('what the answer could not tell us', () => {
  it('says how many entries were counted without their project', () => {
    renderReport(
      <SyncControl
        notices={withheldNotices(reportWith({ withoutProject: 3 }))}
        status={reportWith({ withoutProject: 3 })}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/without their project: 3/i)
  })

  it('says the figures are short when an entry could not be read at all', () => {
    renderReport(
      <SyncControl
        notices={withheldNotices(reportWith({ unread: 1 }))}
        status={reportWith({ unread: 1 })}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/could not read: 1/i)
    expect(screen.getByRole('status')).toHaveTextContent(/short/i)
  })

  it('keeps saying when the hours arrived, beside what was missing', () => {
    renderReport(
      <SyncControl
        notices={withheldNotices(reportWith({ withoutProject: 2 }))}
        status={reportWith({ withoutProject: 2 })}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/updated at 12:00/i)
  })

  it('reports both counts when both happened', () => {
    renderReport(
      <SyncControl
        notices={withheldNotices(reportWith({ unread: 1, withoutProject: 2 }))}
        status={reportWith({ unread: 1, withoutProject: 2 })}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/without their project: 2/i)
    expect(screen.getByRole('status')).toHaveTextContent(/could not read: 1/i)
  })

  it('says nothing about it when every entry was read in full', () => {
    renderReport(<SyncControl notices={withheldNotices(reportWith())} status={reportWith()} />)

    expect(screen.getByRole('status')).not.toHaveTextContent(/project/i)
    expect(screen.getByRole('status')).not.toHaveTextContent(/could not read/i)
  })
})
