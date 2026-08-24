import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~tests/support/render'
import { stubSystemDarkMode } from '~tests/support/system-dark-mode'

import { LocaleField } from './locale-field'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LocaleField', () => {
  it('offers both languages, each named in itself', () => {
    stubSystemDarkMode(false)
    renderWithProviders(<LocaleField />)

    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Português (Brasil)' })).toBeInTheDocument()
  })

  it('switches the interface without reloading the page', async () => {
    stubSystemDarkMode(false)
    renderWithProviders(<LocaleField />)

    expect(screen.getByText('Language')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByRole('combobox'), 'pt-BR')

    expect(screen.getByText('Idioma')).toBeInTheDocument()
    expect(screen.queryByText('Language')).not.toBeInTheDocument()
  })

  it('records the choice so a later visit keeps it', async () => {
    stubSystemDarkMode(false)
    renderWithProviders(<LocaleField />)

    await userEvent.selectOptions(screen.getByRole('combobox'), 'pt-BR')

    expect(globalThis.localStorage.getItem('PARAGLIDE_LOCALE')).toBe('pt-BR')
  })

  it('tells assistive technology which language it is reading', async () => {
    stubSystemDarkMode(false)
    renderWithProviders(<LocaleField />)

    await userEvent.selectOptions(screen.getByRole('combobox'), 'pt-BR')

    expect(document.documentElement).toHaveAttribute('lang', 'pt-BR')
  })
})
