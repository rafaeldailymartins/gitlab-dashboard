import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderReport } from '~tests/support/report'

import type { PeriodSummary } from '@/entities/timelogs'

import { isoDate } from '@/shared/lib/date'
import { memoryStorage } from '@/shared/lib/storage'

import { KpiRow } from './kpi-row'

/** A Friday in a month with 21 weekdays. */
const FRIDAY = isoDate('2026-08-21')

const SECONDS_PER_HOUR = 3600

function figure(label: string) {
  return within(screen.getByRole('group', { name: label }))
}

function row(overrides: Partial<Parameters<typeof KpiRow>[0]> = {}) {
  return (
    <KpiRow
      day={FRIDAY}
      dayTotal={summary(6.7)}
      loading={false}
      month={summary(120)}
      today={FRIDAY}
      week={summary(32)}
      {...overrides}
    />
  )
}

function summary(hours: number, settled = true): PeriodSummary {
  return { entryCount: 1, hours, seconds: hours * SECONDS_PER_HOUR, settled }
}

function withoutTargets() {
  const storage = memoryStorage()
  storage.write(
    'preferences',
    JSON.stringify({ dailyTarget: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 } }),
  )

  return storage
}

describe('KpiRow', () => {
  it('shows today, this week and this month', () => {
    renderReport(row())

    expect(figure('Today').getByRole('definition')).toHaveTextContent('6.7')
    expect(figure('This week').getByRole('definition')).toHaveTextContent('32')
    expect(figure('This month').getByRole('definition')).toHaveTextContent('120')
  })

  it('measures each period against the target for that period', () => {
    renderReport(row())

    expect(figure('Today').getByRole('definition')).toHaveTextContent('of 8 h')
    expect(figure('This week').getByRole('definition')).toHaveTextContent('of 40 h')
    expect(figure('This month').getByRole('definition')).toHaveTextContent('of 168 h')
  })

  it('reads a period with nothing logged as zero rather than as missing', () => {
    renderReport(row({ dayTotal: summary(0), month: summary(0), week: summary(0) }))

    expect(figure('Today').getByRole('definition')).toHaveTextContent('0')
    expect(figure('Today').getByRole('definition')).toHaveTextContent('8 h to go')
  })

  it('waits rather than claiming zero before anything has loaded', () => {
    renderReport(row({ loading: true }))

    expect(figure('Today').queryByText(/hours/)).not.toBeInTheDocument()
  })

  it('says a total is still rising while its period is unsettled', () => {
    renderReport(row({ month: summary(120, false) }))

    expect(figure('This month').getByText(/Still loading/i)).toBeInTheDocument()
  })

  it('says nothing of the sort once every period has settled', () => {
    renderReport(row())

    expect(screen.queryByText(/Still loading/i)).not.toBeInTheDocument()
  })

  it('says a period has no target instead of inventing a percentage', () => {
    renderReport(row(), { storage: withoutTargets() })

    expect(figure('Today').getByRole('definition')).toHaveTextContent('no target')
  })
})
