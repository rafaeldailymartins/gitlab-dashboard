import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fakeSessionManager, renderWithSession } from '~tests/support/session'

import { LoginPage } from './login-page'

/** The one button this screen exists for. */
const SIGN_IN = { name: /continue with gitlab/i }

describe('LoginPage', () => {
  it('is titled', () => {
    renderWithSession(<LoginPage destination="/" />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sign in')
  })

  it('names the product the reader is signing in to', () => {
    renderWithSession(<LoginPage destination="/" />)

    expect(screen.getByText('GitLab Dashboard')).toBeInTheDocument()
  })

  it('keeps the decorative week out of the reading order', () => {
    renderWithSession(<LoginPage destination="/" />)

    // The art is the product's silhouette, not information. Testing Library
    // finds text inside an `aria-hidden` subtree while a screen reader never
    // announces it, so the only way to assert the reader is spared it is to
    // check the subtree itself — the mirror image of the `aria-label`-on-a-span
    // bug this project already shipped once.
    // eslint-disable-next-line testing-library/no-node-access
    expect(screen.getByText('Mon').closest('[aria-hidden="true"]')).not.toBeNull()
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

  it('lets a reader pick a colour scheme before signing in', () => {
    renderWithSession(<LoginPage destination="/" />)

    // Without the signed-in header there is nowhere else to change it, and a
    // reader who lands here after signing out would be stuck with the system's.
    expect(
      screen.getByRole('button', { name: /switch to the (dark|light) colour scheme/i }),
    ).toBeInTheDocument()
  })

  it('sends the reader to GitLab', async () => {
    const manager = fakeSessionManager()
    const { navigateAway } = renderWithSession(<LoginPage destination="/" />, { manager })

    await userEvent.click(screen.getByRole('button', SIGN_IN))

    expect(manager.startSignIn).toHaveBeenCalledWith('/')
    expect(navigateAway).toHaveBeenCalledWith('https://gitlab.example/oauth/authorize')
  })

  it('carries the destination through, so a deep link is not lost', async () => {
    const manager = fakeSessionManager()
    renderWithSession(<LoginPage destination="/days/2026-08-20" />, { manager })

    await userEvent.click(screen.getByRole('button', SIGN_IN))

    expect(manager.startSignIn).toHaveBeenCalledWith('/days/2026-08-20')
  })

  it('stops a second click starting a second authorization', async () => {
    const manager = fakeSessionManager()
    renderWithSession(<LoginPage destination="/" />, { manager })

    await userEvent.click(screen.getByRole('button', SIGN_IN))
    await userEvent.click(screen.getByRole('button', SIGN_IN))

    expect(manager.startSignIn).toHaveBeenCalledTimes(1)
  })

  it('explains a sign-in that never reached GitLab, and lets it be tried again', async () => {
    const manager = fakeSessionManager({
      startSignIn: vi.fn(() => Promise.reject(new Error('no subtle crypto here'))),
    })
    renderWithSession(<LoginPage destination="/" />, { manager })

    await userEvent.click(screen.getByRole('button', SIGN_IN))

    // The alternative is what this screen shipped as: a dimmed button, no
    // message, and nothing announced — on a screen with no header to leave by.
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be reached/i)
    expect(screen.getByRole('button', SIGN_IN)).toBeEnabled()

    await userEvent.click(screen.getByRole('button', SIGN_IN))

    expect(manager.startSignIn).toHaveBeenCalledTimes(2)
  })

  it('puts the action this screen exists for first in the tab order', async () => {
    const manager = fakeSessionManager()
    renderWithSession(<LoginPage destination="/" />, { manager })

    await userEvent.tab()

    expect(screen.getByRole('button', SIGN_IN)).toHaveFocus()

    await userEvent.keyboard('{Enter}')

    expect(manager.startSignIn).toHaveBeenCalled()
  })
})
