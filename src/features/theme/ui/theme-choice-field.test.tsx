import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~tests/support/render'
import { stubSystemDarkMode } from '~tests/support/system-dark-mode'

import { memoryStorage } from '@/shared/lib/storage'

import { ThemeChoiceField } from './theme-choice-field'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ThemeChoiceField', () => {
  it('offers following the system as well as both explicit choices', () => {
    stubSystemDarkMode(false)
    renderWithProviders(<ThemeChoiceField />)

    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(screen.getByRole('option', { name: /follow my system/i })).toBeInTheDocument()
  })

  it('starts on "follow my system" when nothing was chosen', () => {
    stubSystemDarkMode(false)
    renderWithProviders(<ThemeChoiceField />)

    expect(screen.getByRole('combobox')).toHaveValue('system')
  })

  it('applies and stores an explicit choice', async () => {
    stubSystemDarkMode(false)
    const storage = memoryStorage()
    renderWithProviders(<ThemeChoiceField />, { storage })

    await userEvent.selectOptions(screen.getByRole('combobox'), 'dark')

    expect(document.documentElement).toHaveClass('dark')
    expect(storage.read('theme')).toBe('dark')
  })

  it('goes back to following the system', async () => {
    stubSystemDarkMode(true)
    const storage = memoryStorage()
    storage.write('theme', 'light')
    renderWithProviders(<ThemeChoiceField />, { storage })

    expect(document.documentElement).not.toHaveClass('dark')

    await userEvent.selectOptions(screen.getByRole('combobox'), 'system')

    expect(document.documentElement).toHaveClass('dark')
  })
})
