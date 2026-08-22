import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~tests/support/render'
import { stubSystemDarkMode } from '~tests/support/system-dark-mode'

import { SettingsPage } from './settings-page'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SettingsPage', () => {
  it('is titled, with one heading for the page', () => {
    stubSystemDarkMode(false)
    renderWithProviders(<SettingsPage />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Settings')
  })

  it('groups the schedule settings together', () => {
    stubSystemDarkMode(false)
    renderWithProviders(<SettingsPage />)

    expect(screen.getByText('Working schedule')).toBeInTheDocument()
    expect(screen.getAllByRole('spinbutton')).toHaveLength(7)
    expect(screen.getByLabelText('Time zone')).toBeInTheDocument()
  })

  it('groups the appearance settings together', () => {
    stubSystemDarkMode(false)
    renderWithProviders(<SettingsPage />)

    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByLabelText('Language')).toBeInTheDocument()
    expect(screen.getByLabelText('Colour scheme')).toBeInTheDocument()
  })

  it('renders every setting in the chosen language', async () => {
    stubSystemDarkMode(false)
    renderWithProviders(<SettingsPage />)

    await userEvent.selectOptions(screen.getByLabelText('Language'), 'pt-BR')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Configurações')
    expect(screen.getByText('Jornada de trabalho')).toBeInTheDocument()
    expect(screen.getByLabelText('Fuso horário')).toBeInTheDocument()
  })
})
