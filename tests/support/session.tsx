import type { ReactNode } from 'react'

import { render } from '@testing-library/react'
import { vi } from 'vitest'

import { type SessionManager, SessionProvider } from '@/entities/sessions'
import { LocaleProvider } from '@/shared/i18n'

interface SessionRenderOptions {
  readonly manager?: ReturnType<typeof fakeSessionManager>
  readonly navigateAway?: (url: string) => void
}

/** A manager whose every call a test can observe or redirect. */
export function fakeSessionManager(overrides: Partial<SessionManager> = {}) {
  return {
    accessToken: vi.fn(() => Promise.resolve('access-1')),
    completeSignIn: vi.fn(() => Promise.resolve('/')),
    hasSession: vi.fn(() => false),
    refresh: vi.fn(() => Promise.resolve('access-1')),
    signOut: vi.fn(() => Promise.resolve()),
    startSignIn: vi.fn(() => Promise.resolve('https://gitlab.example/oauth/authorize')),
    ...overrides,
  }
}

/** Renders inside the session and locale providers, without a router. */
export function renderWithSession(ui: ReactNode, options: SessionRenderOptions = {}) {
  const manager = options.manager ?? fakeSessionManager()
  const navigateAway = options.navigateAway ?? vi.fn()

  return {
    manager,
    navigateAway,
    ...render(
      <LocaleProvider>
        <SessionProvider manager={manager} navigateAway={navigateAway}>
          {ui}
        </SessionProvider>
      </LocaleProvider>,
    ),
  }
}
