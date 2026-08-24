import type { ReactNode } from 'react'

import { render } from '@testing-library/react'
import { vi } from 'vitest'

import { PreferencesProvider, preferencesStore } from '@/entities/preferences'
import { type SessionManager, SessionProvider } from '@/entities/sessions'
import { LocaleProvider } from '@/shared/i18n'
import { memoryStorage } from '@/shared/lib/storage'

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

/**
 * Renders inside the providers the app mounts around a session, without a
 * router. Preferences are in the stack because the sign-in screen carries the
 * colour-scheme control, exactly as the real tree does — backed by in-memory
 * storage so no test inherits what another one saved.
 */
export function renderWithSession(ui: ReactNode, options: SessionRenderOptions = {}) {
  const manager = options.manager ?? fakeSessionManager()
  const navigateAway = options.navigateAway ?? vi.fn()

  return {
    manager,
    navigateAway,
    ...render(
      <PreferencesProvider store={preferencesStore(memoryStorage())}>
        <LocaleProvider>
          <SessionProvider manager={manager} navigateAway={navigateAway}>
            {ui}
          </SessionProvider>
        </LocaleProvider>
      </PreferencesProvider>,
    ),
  }
}
