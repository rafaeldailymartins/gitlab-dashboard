import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderReport } from '~tests/support/report'

import type { DayTotal } from '@/entities/timelogs'

import { isoDate } from '@/shared/lib/date'

import { WeekStrip } from './week-strip'

/** A Friday, so the week under test runs Monday the 17th to Sunday the 23rd. */
const FRIDAY = isoDate('2026-08-21')

const SECONDS_PER_HOUR = 3600

function day(date: string, hours: number): DayTotal {
  return {
    date: isoDate(date),
    entryCount: 1,
    hours,
    items: [],
    seconds: hours * SECONDS_PER_HOUR,
  }
}

function strip(days: DayTotal[] = [], onSelect = vi.fn()) {
  return <WeekStrip days={days} loading={false} onSelect={onSelect} today={FRIDAY} />
}

describe('WeekStrip', () => {
  it('shows all seven days, including the ones with nothing logged', () => {
    renderReport(strip([day('2026-08-17', 8)]))

    expect(screen.getAllByRole('button')).toHaveLength(7)
  })

  it('names a day that met its target with its hours and its target', () => {
    renderReport(strip([day('2026-08-17', 8)]))

    expect(
      screen.getByRole('button', { name: /Mon: 8 hours of a 8 hour target/i }),
    ).toBeInTheDocument()
  })

  it('names a day that fell short the same way, rather than hiding it', () => {
    renderReport(strip([day('2026-08-18', 3.5)]))

    expect(
      screen.getByRole('button', { name: /Tue: 3.5 hours of a 8 hour target/i }),
    ).toBeInTheDocument()
  })

  it('says a weekend has no target instead of announcing zero', () => {
    renderReport(strip([day('2026-08-22', 2)]))

    expect(screen.getByRole('button', { name: /Sat: 2 hours, no target/i })).toBeInTheDocument()
  })

  it('prints the hours beside the bar, so nothing is carried by height alone', () => {
    renderReport(strip([day('2026-08-19', 6.7)]))

    expect(screen.getByText('6.7')).toBeInTheDocument()
  })

  it('leaves a day with nothing logged unlabelled rather than showing a zero', () => {
    renderReport(strip([day('2026-08-19', 6.7)]))

    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('draws a skeleton rather than seven empty bars before anything has loaded', () => {
    renderReport(<WeekStrip days={[]} loading onSelect={vi.fn()} today={FRIDAY} />)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('opens the day a reader picks', async () => {
    const onSelect = vi.fn()
    renderReport(strip([day('2026-08-19', 6.7)], onSelect))

    await userEvent.click(screen.getByRole('button', { name: /Wed/i }))

    expect(onSelect).toHaveBeenCalledWith('2026-08-19')
  })

  it('is reachable and operable from the keyboard alone', async () => {
    const onSelect = vi.fn()
    renderReport(strip([], onSelect))

    await userEvent.tab()
    await userEvent.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledWith('2026-08-17')
  })

  it('marks today, so the week reads from where the reader is', () => {
    renderReport(strip())

    expect(screen.getByRole('button', { current: 'date' })).toHaveAccessibleName(/Fri/i)
  })
})
