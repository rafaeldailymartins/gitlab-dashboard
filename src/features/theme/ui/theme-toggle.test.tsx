import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~tests/support/render'
import { stubSystemDarkMode } from '~tests/support/system-dark-mode'

import { memoryStorage } from '@/shared/lib/storage'

import { ThemeToggle } from './theme-toggle'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ThemeToggle', () => {
  it('offers to go dark while the interface is light', () => {
    stubSystemDarkMode(false)
    renderWithProviders(<ThemeToggle />)

    expect(screen.getByRole('button', { name: /dark colour scheme/i })).toBeInTheDocument()
  })

  it('offers to go light while the interface is dark', () => {
    stubSystemDarkMode(true)
    renderWithProviders(<ThemeToggle />)

    expect(screen.getByRole('button', { name: /light colour scheme/i })).toBeInTheDocument()
  })

  it('switches to dark and remembers the choice', async () => {
    stubSystemDarkMode(false)
    const storage = memoryStorage()
    renderWithProviders(<ThemeToggle />, { storage })

    await userEvent.click(screen.getByRole('button'))

    expect(document.documentElement).toHaveClass('dark')
    expect(storage.read('theme')).toBe('dark')
  })

  it('switches back to light', async () => {
    stubSystemDarkMode(true)
    const storage = memoryStorage()
    renderWithProviders(<ThemeToggle />, { storage })

    await userEvent.click(screen.getByRole('button'))

    expect(document.documentElement).not.toHaveClass('dark')
    expect(storage.read('theme')).toBe('light')
  })

  it('is reachable and operable by keyboard alone', async () => {
    stubSystemDarkMode(false)
    renderWithProviders(<ThemeToggle />)

    await userEvent.tab()

    expect(screen.getByRole('button')).toHaveFocus()

    await userEvent.keyboard('{Enter}')

    expect(document.documentElement).toHaveClass('dark')
  })
})
