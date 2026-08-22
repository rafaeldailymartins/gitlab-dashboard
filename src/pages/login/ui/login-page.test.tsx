import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeSessionManager, renderWithSession } from '~tests/support/session'

import { LoginPage } from './login-page'

describe('LoginPage', () => {
  it('is titled', () => {
    renderWithSession(<LoginPage destination="/" />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sign in')
  })

  it('says the access it asks for is read-only', () => {
    renderWithSession(<LoginPage destination="/" />)

    expect(screen.getByText(/read-only/i)).toBeInTheDocument()
  })

  it('offers nowhere to paste a token', () => {
    renderWithSession(<LoginPage destination="/" />)

    // The whole point of the rebuild: no Personal Access Token, anywhere.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    // No role-based query can express "no input element at all": a password
    // input has no accessible role, and that is exactly what must not exist.
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector('input')).toBeNull()
  })

  it('sends the reader to GitLab', async () => {
    const manager = fakeSessionManager()
    const { navigateAway } = renderWithSession(<LoginPage destination="/" />, { manager })

    await userEvent.click(screen.getByRole('button'))

    expect(manager.startSignIn).toHaveBeenCalledWith('/')
    expect(navigateAway).toHaveBeenCalledWith('https://gitlab.example/oauth/authorize')
  })

  it('carries the destination through, so a deep link is not lost', async () => {
    const manager = fakeSessionManager()
    renderWithSession(<LoginPage destination="/days/2026-08-20" />, { manager })

    await userEvent.click(screen.getByRole('button'))

    expect(manager.startSignIn).toHaveBeenCalledWith('/days/2026-08-20')
  })

  it('stops a second click starting a second authorization', async () => {
    const manager = fakeSessionManager()
    renderWithSession(<LoginPage destination="/" />, { manager })

    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByRole('button'))

    expect(manager.startSignIn).toHaveBeenCalledTimes(1)
  })

  it('is operable by keyboard alone', async () => {
    const manager = fakeSessionManager()
    renderWithSession(<LoginPage destination="/" />, { manager })

    await userEvent.tab()

    expect(screen.getByRole('button')).toHaveFocus()

    await userEvent.keyboard('{Enter}')

    expect(manager.startSignIn).toHaveBeenCalled()
  })
})
