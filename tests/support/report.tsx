import type { ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { vi } from 'vitest'

import { PreferencesProvider, preferencesStore } from '@/entities/preferences'
import { type TimelogGateway, TimelogGatewayProvider, type TimelogPage } from '@/entities/timelogs'
import { LocaleProvider } from '@/shared/i18n'
import { type KeyValueStorage, memoryStorage } from '@/shared/lib/storage'

interface ReportRenderOptions {
  readonly gateway?: TimelogGateway
  readonly storage?: KeyValueStorage
}

/** A gateway that always fails, for the paths where GitLab does not answer. */
export function failingGateway(error: Error) {
  return { myTimelogs: vi.fn(() => Promise.reject(error)) } satisfies TimelogGateway
}

/** A gateway that answers with the pages given, in order. */
export function fakeGateway(pages: TimelogPage[]) {
  let call = 0

  const myTimelogs = vi.fn(() => {
    const page = pages[Math.min(call, pages.length - 1)]
    call += 1

    return Promise.resolve(page ?? { entries: [], nextCursor: null })
  })

  return { myTimelogs } satisfies TimelogGateway
}

/**
 * Renders inside the providers a screen reading hours needs.
 *
 * Retries are off: a test asserting a failure should not wait for the retries
 * the real client makes, and a test asserting success never needs them.
 */
export function renderReport(ui: ReactNode, options: ReportRenderOptions = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const gateway = options.gateway ?? fakeGateway([{ entries: [], nextCursor: null }])
  const store = preferencesStore(options.storage ?? memoryStorage())

  return {
    client,
    gateway,
    ...render(
      <QueryClientProvider client={client}>
        <PreferencesProvider store={store}>
          <LocaleProvider>
            <TimelogGatewayProvider gateway={gateway}>{ui}</TimelogGatewayProvider>
          </LocaleProvider>
        </PreferencesProvider>
      </QueryClientProvider>,
    ),
  }
}
