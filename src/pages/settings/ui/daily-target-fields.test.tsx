import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~tests/support/render'
import { stubSystemDarkMode } from '~tests/support/system-dark-mode'

import { memoryStorage } from '@/shared/lib/storage'

import { DailyTargetFields } from './daily-target-fields'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DailyTargetFields', () => {
  it('offers one field per weekday', () => {
    stubSystemDarkMode(false)
    renderWithProviders(<DailyTargetFields />)

    expect(screen.getAllByRole('spinbutton')).toHaveLength(7)
  })

  it('names each field after its weekday', () => {
    stubSystemDarkMode(false)
    renderWithProviders(<DailyTargetFields />)

    expect(screen.getByLabelText('Mon')).toBeInTheDocument()
    expect(screen.getByLabelText('Sun')).toBeInTheDocument()
  })

  it('shows the default working week', () => {
    stubSystemDarkMode(false)
    renderWithProviders(<DailyTargetFields />)

    expect(screen.getByLabelText('Mon')).toHaveValue(8)
    expect(screen.getByLabelText('Sat')).toHaveValue(0)
  })

  it('stores a changed weekday without disturbing the others', async () => {
    stubSystemDarkMode(false)
    const storage = memoryStorage()
    renderWithProviders(<DailyTargetFields />, { storage })

    await userEvent.clear(screen.getByLabelText('Fri'))
    await userEvent.type(screen.getByLabelText('Fri'), '6')

    expect(screen.getByLabelText('Mon')).toHaveValue(8)

    const stored: unknown = JSON.parse(storage.read('preferences') ?? '{}')

    expect(stored).toMatchObject({ dailyTarget: { 1: 8, 5: 6 } })
  })
})
