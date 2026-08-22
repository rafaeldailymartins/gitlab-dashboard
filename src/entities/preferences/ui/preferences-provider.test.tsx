import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~tests/support/render'
import { stubSystemDarkMode } from '~tests/support/system-dark-mode'

import { memoryStorage } from '@/shared/lib/storage'

import { preferencesStore } from '../api/preferences-store'
import { withTimeZone } from '../model/preferences'
import { PreferencesProvider, usePreferences } from './preferences-provider'

function Probe() {
  const { preferences, resolvedTheme, setPreferences, setThemeChoice, themeChoice } =
    usePreferences()

  return (
    <div>
      <p data-testid="time-zone">{preferences.timeZone}</p>
      <p data-testid="monday-target">{preferences.dailyTarget[1]}</p>
      <p data-testid="theme-choice">{themeChoice}</p>
      <p data-testid="resolved-theme">{resolvedTheme}</p>
      <button
        onClick={() => {
          setPreferences(withTimeZone(preferences, 'Asia/Tokyo'))
        }}
        type="button"
      >
        change zone
      </button>
      <button
        onClick={() => {
          setThemeChoice('light')
        }}
        type="button"
      >
        choose light
      </button>
    </div>
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PreferencesProvider', () => {
  it('starts from the defaults when nothing was ever stored', () => {
    stubSystemDarkMode(false)
    renderWithProviders(<Probe />)

    expect(screen.getByTestId('time-zone')).toHaveTextContent('America/Sao_Paulo')
    expect(screen.getByTestId('monday-target')).toHaveTextContent('8')
    expect(screen.getByTestId('theme-choice')).toHaveTextContent('system')
  })

  it('starts from settings saved on a previous visit', () => {
    stubSystemDarkMode(false)
    const storage = memoryStorage()
    preferencesStore(storage).writePreferences(
      withTimeZone(
        { dailyTarget: { 1: 6, 2: 8, 3: 8, 4: 8, 5: 8, 6: 0, 7: 0 }, timeZone: 'UTC' },
        'Europe/Lisbon',
      ),
    )

    renderWithProviders(<Probe />, { storage })

    expect(screen.getByTestId('time-zone')).toHaveTextContent('Europe/Lisbon')
    expect(screen.getByTestId('monday-target')).toHaveTextContent('6')
  })

  it('falls back to the defaults when the stored value is damaged', () => {
    stubSystemDarkMode(false)
    const storage = memoryStorage()
    storage.write('preferences', '{ not json')

    renderWithProviders(<Probe />, { storage })

    expect(screen.getByTestId('time-zone')).toHaveTextContent('America/Sao_Paulo')
  })

  it('writes a change through to storage', async () => {
    stubSystemDarkMode(false)
    const storage = memoryStorage()
    renderWithProviders(<Probe />, { storage })

    await userEvent.click(screen.getByRole('button', { name: 'change zone' }))

    expect(screen.getByTestId('time-zone')).toHaveTextContent('Asia/Tokyo')
    expect(storage.read('preferences')).toContain('Asia/Tokyo')
  })

  it('follows the system when no theme was chosen', () => {
    stubSystemDarkMode(true)
    renderWithProviders(<Probe />)

    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('follows the system as it changes, while no theme was chosen', () => {
    const system = stubSystemDarkMode(false)
    renderWithProviders(<Probe />)

    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light')

    system.change(true)

    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('lets an explicit choice override the system', async () => {
    stubSystemDarkMode(true)
    const storage = memoryStorage()
    renderWithProviders(<Probe />, { storage })

    await userEvent.click(screen.getByRole('button', { name: 'choose light' }))

    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(storage.read('theme')).toBe('light')
  })

  it('works without matchMedia at all', () => {
    vi.stubGlobal('matchMedia', null)
    renderWithProviders(<Probe />)

    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light')
  })
})

describe('usePreferences', () => {
  it('refuses to be used outside the provider', () => {
    // React logs the error it re-throws; the assertion is what matters.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn())

    expect(() => render(<Probe />)).toThrow(/outside a PreferencesProvider/)

    consoleError.mockRestore()
  })

  it('is available to anything inside the provider', () => {
    stubSystemDarkMode(false)
    const store = preferencesStore(memoryStorage())

    render(
      <PreferencesProvider store={store}>
        <Probe />
      </PreferencesProvider>,
    )

    expect(screen.getByTestId('theme-choice')).toHaveTextContent('system')
  })
})
