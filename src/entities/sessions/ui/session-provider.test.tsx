import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fakeSessionManager, renderWithSession } from '~tests/support/session'

import { useSession } from './session-provider'

function Probe() {
  const { completeSignIn, isSignedIn, signIn, signOut } = useSession()

  return (
    <div>
      <p data-testid="state">{isSignedIn ? 'in' : 'out'}</p>
      <button
        onClick={() => {
          void signIn('/days/2026-08-20')
        }}
        type="button"
      >
        sign in
      </button>
      <button
        onClick={() => {
          void completeSignIn('code', 'state')
        }}
        type="button"
      >
        complete
      </button>
      <button
        onClick={() => {
          void signOut()
        }}
        type="button"
      >
        sign out
      </button>
    </div>
  )
}

describe('SessionProvider', () => {
  it('starts signed out when no session can be resumed', () => {
    renderWithSession(<Probe />)

    expect(screen.getByTestId('state')).toHaveTextContent('out')
  })

  it('starts signed in when a session can be resumed', () => {
    const manager = fakeSessionManager({ hasSession: vi.fn(() => true) })
    renderWithSession(<Probe />, { manager })

    expect(screen.getByTestId('state')).toHaveTextContent('in')
  })

  it('navigates away to start a sign-in', async () => {
    const { manager, navigateAway } = renderWithSession(<Probe />)

    await userEvent.click(screen.getByRole('button', { name: 'sign in' }))

    expect(manager.startSignIn).toHaveBeenCalledWith('/days/2026-08-20')
    expect(navigateAway).toHaveBeenCalledWith('https://gitlab.example/oauth/authorize')
  })

  it('becomes signed in once the exchange succeeds', async () => {
    renderWithSession(<Probe />)

    await userEvent.click(screen.getByRole('button', { name: 'complete' }))

    expect(screen.getByTestId('state')).toHaveTextContent('in')
  })

  it('becomes signed out immediately, before revocation is even attempted', async () => {
    const manager = fakeSessionManager({
      hasSession: vi.fn(() => true),
      signOut: vi.fn(() => Promise.reject(new Error('offline'))),
    })
    renderWithSession(<Probe />, { manager })

    await userEvent.click(screen.getByRole('button', { name: 'sign out' }))

    // Whatever the provider says about revocation, the reader is out here —
    // and the failure does not surface, because nothing could be done about it.
    expect(screen.getByTestId('state')).toHaveTextContent('out')
    expect(manager.signOut).toHaveBeenCalledOnce()
  })
})

describe('useSession', () => {
  it('refuses to be used outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn())

    expect(() => render(<Probe />)).toThrow(/outside a SessionProvider/)

    consoleError.mockRestore()
  })
})
