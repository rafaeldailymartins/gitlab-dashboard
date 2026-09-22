import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~tests/support/render'
import { stubSystemDarkMode } from '~tests/support/system-dark-mode'

import { SettingsPage } from './settings-page'

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * No router around it any more.
 *
 * This screen used to link to `/teams`, which is why it was rendered inside one.
 * The teams a reader keeps are edited in a dialog over whichever screen asked
 * for it, so there is no address here to resolve and nothing for a router to
 * answer.
 */
function renderSettings() {
  return renderWithProviders(<SettingsPage />)
}

describe('SettingsPage', () => {
  it('is titled, with one heading for the page', async () => {
    stubSystemDarkMode(false)
    renderSettings()

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Settings')
  })

  it('groups the schedule settings together', async () => {
    stubSystemDarkMode(false)
    renderSettings()

    expect(await screen.findByText('Working schedule')).toBeInTheDocument()
    expect(screen.getAllByRole('spinbutton')).toHaveLength(7)
    expect(screen.getByLabelText('Time zone')).toBeInTheDocument()
  })

  // Not a link and not a fifth navigation entry: it opens a dialog over this
  // screen, so nothing about where the reader is changes.
  it('opens the teams a reader keeps, without going anywhere', async () => {
    stubSystemDarkMode(false)
    renderSettings()

    expect(await screen.findByRole('button', { name: /manage teams/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /manage teams/i })).not.toBeInTheDocument()
  })

  it('groups the appearance settings together', async () => {
    stubSystemDarkMode(false)
    renderSettings()

    expect(await screen.findByText('Appearance')).toBeInTheDocument()
    expect(screen.getByLabelText('Language')).toBeInTheDocument()
    expect(screen.getByLabelText('Colour scheme')).toBeInTheDocument()
  })

  it('renders every setting in the chosen language', async () => {
    stubSystemDarkMode(false)
    renderSettings()

    await userEvent.selectOptions(await screen.findByLabelText('Language'), 'pt-BR')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Configurações')
    expect(screen.getByText('Jornada de trabalho')).toBeInTheDocument()
    expect(screen.getByLabelText('Fuso horário')).toBeInTheDocument()
  })
})
