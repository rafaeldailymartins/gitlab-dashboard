import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fakeSessionManager, renderWithSession } from '~tests/support/session'

import { AuthError } from '@/entities/sessions'

import { AuthCallbackPage } from './auth-callback-page'

const CODE = 'the-code'
const STATE = 'the-state'

describe('AuthCallbackPage', () => {
  it('exchanges the code and hands over the remembered destination', async () => {
    const manager = fakeSessionManager({
      completeSignIn: vi.fn(() => Promise.resolve('/days/2026-08-20')),
    })
    const onSignedIn = vi.fn()

    renderWithSession(
      <AuthCallbackPage code={CODE} error={null} onSignedIn={onSignedIn} state={STATE} />,
      { manager },
    )

    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalledWith('/days/2026-08-20')
    })
    expect(manager.completeSignIn).toHaveBeenCalledWith(CODE, STATE)
  })

  it('says what it is doing while the exchange is in flight', () => {
    renderWithSession(
      <AuthCallbackPage code={CODE} error={null} onSignedIn={vi.fn()} state={STATE} />,
    )

    expect(screen.getByText(/finishing sign-in/i)).toBeInTheDocument()
  })

  it('announces progress to assistive technology', () => {
    renderWithSession(
      <AuthCallbackPage code={CODE} error={null} onSignedIn={vi.fn()} state={STATE} />,
    )

    expect(screen.getByText(/finishing sign-in/i)).toHaveAttribute('aria-live', 'polite')
  })

  it('reports a declined authorization without attempting an exchange', () => {
    const manager = fakeSessionManager()

    renderWithSession(
      <AuthCallbackPage code={null} error="access_denied" onSignedIn={vi.fn()} state={null} />,
      { manager },
    )

    expect(screen.getByText(/did not grant access/i)).toBeInTheDocument()
    expect(manager.completeSignIn).not.toHaveBeenCalled()
  })

  it('refuses a callback with no code, rather than asking GitLab about it', () => {
    const manager = fakeSessionManager()

    renderWithSession(
      <AuthCallbackPage code={null} error={null} onSignedIn={vi.fn()} state={STATE} />,
      { manager },
    )

    expect(screen.getByText(/could not be verified/i)).toBeInTheDocument()
    expect(manager.completeSignIn).not.toHaveBeenCalled()
  })

  it('explains a state mismatch the manager rejected', async () => {
    const manager = fakeSessionManager({
      completeSignIn: vi.fn(() => Promise.reject(new AuthError({ kind: 'state-mismatch' }))),
    })

    renderWithSession(
      <AuthCallbackPage code={CODE} error={null} onSignedIn={vi.fn()} state={STATE} />,
      { manager },
    )

    expect(await screen.findByText(/could not be verified/i)).toBeInTheDocument()
  })

  it('distinguishes an unreachable provider from a refused sign-in', async () => {
    const manager = fakeSessionManager({
      completeSignIn: vi.fn(() => Promise.reject(new AuthError({ kind: 'provider-unavailable' }))),
    })

    renderWithSession(
      <AuthCallbackPage code={CODE} error={null} onSignedIn={vi.fn()} state={STATE} />,
      { manager },
    )

    expect(await screen.findByText(/could not be reached/i)).toBeInTheDocument()
  })

  it('treats an unrecognised failure as the provider being unavailable', async () => {
    const manager = fakeSessionManager({
      completeSignIn: vi.fn(() => Promise.reject(new Error('something else'))),
    })

    renderWithSession(
      <AuthCallbackPage code={CODE} error={null} onSignedIn={vi.fn()} state={STATE} />,
      { manager },
    )

    expect(await screen.findByText(/could not be reached/i)).toBeInTheDocument()
  })

  it('offers a way back to sign-in after a failure', () => {
    renderWithSession(
      <AuthCallbackPage code={null} error="access_denied" onSignedIn={vi.fn()} state={null} />,
    )

    expect(screen.getByRole('link', { name: /try again/i })).toHaveAttribute('href', '/login')
  })

  it('exchanges the code only once', async () => {
    const manager = fakeSessionManager()
    const onSignedIn = vi.fn()

    renderWithSession(
      <AuthCallbackPage code={CODE} error={null} onSignedIn={onSignedIn} state={STATE} />,
      { manager },
    )

    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalled()
    })

    // The exchange consumes the pending request; a second attempt would find
    // nothing pending and report a mismatch.
    expect(manager.completeSignIn).toHaveBeenCalledTimes(1)
  })
})

describe('AuthCallbackPage with an incomplete address', () => {
  it('refuses a callback with a code but no state', () => {
    const manager = fakeSessionManager()

    renderWithSession(
      <AuthCallbackPage code={CODE} error={null} onSignedIn={vi.fn()} state={null} />,
      { manager },
    )

    expect(screen.getByText(/could not be verified/i)).toBeInTheDocument()
    expect(manager.completeSignIn).not.toHaveBeenCalled()
  })
})
