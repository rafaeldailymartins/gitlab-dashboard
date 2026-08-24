import type { ReactNode } from 'react'

import { render } from '@testing-library/react'

import { PreferencesProvider, preferencesStore } from '@/entities/preferences'
import { LocaleProvider } from '@/shared/i18n'
import { type KeyValueStorage, memoryStorage } from '@/shared/lib/storage'

interface ProviderOptions {
  /** Pre-seeded storage, for starting a test from saved settings. */
  readonly storage?: KeyValueStorage
}

/**
 * Renders inside the providers the app mounts, backed by in-memory storage so
 * no test depends on what another test left on the device.
 */
export function renderWithProviders(ui: ReactNode, { storage }: ProviderOptions = {}) {
  const store = preferencesStore(storage ?? memoryStorage())

  return {
    store,
    ...render(
      <PreferencesProvider store={store}>
        <LocaleProvider>{ui}</LocaleProvider>
      </PreferencesProvider>,
    ),
  }
}
