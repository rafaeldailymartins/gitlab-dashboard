import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~tests/support/render'
import { stubSystemDarkMode } from '~tests/support/system-dark-mode'

import { memoryStorage } from '@/shared/lib/storage'

import { TimeZoneField } from './time-zone-field'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TimeZoneField', () => {
  it('starts on the default zone', () => {
    stubSystemDarkMode(false)
    renderWithProviders(<TimeZoneField />)

    expect(screen.getByRole('combobox')).toHaveValue('America/Sao_Paulo')
  })

  it('explains why the zone matters', () => {
    stubSystemDarkMode(false)
    renderWithProviders(<TimeZoneField />)

    expect(screen.getByRole('combobox')).toHaveAccessibleDescription(/day/i)
  })

  it('offers the zones the runtime knows about', () => {
    stubSystemDarkMode(false)
    renderWithProviders(<TimeZoneField />)

    // The IANA database has hundreds of zones; the exact count is not the point.
    expect(screen.getAllByRole('option').length).toBeGreaterThan(50)
  })

  it('reads underscores as spaces, so the list is readable', () => {
    stubSystemDarkMode(false)
    renderWithProviders(<TimeZoneField />)

    expect(screen.getByRole('option', { name: 'America/Sao Paulo' })).toBeInTheDocument()
  })

  it('applies and stores a new zone', async () => {
    stubSystemDarkMode(false)
    const storage = memoryStorage()
    renderWithProviders(<TimeZoneField />, { storage })

    await userEvent.selectOptions(screen.getByRole('combobox'), 'Asia/Tokyo')

    expect(screen.getByRole('combobox')).toHaveValue('Asia/Tokyo')
    expect(storage.read('preferences')).toContain('Asia/Tokyo')
  })
})
