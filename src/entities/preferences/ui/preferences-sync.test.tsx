import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { stubSystemDarkMode } from '~tests/support/system-dark-mode'

import { memoryStorage } from '@/shared/lib/storage'

import type { PreferencesDocument, PreferencesGateway } from '../model/ports'
import type { StoredPreferences } from '../model/preferences'

import { preferencesStore } from '../api/preferences-store'
import { DEFAULT_PREFERENCES, withTimeZone } from '../model/preferences'
import { PreferencesProvider, usePreferences } from './preferences-provider'

const EARLIER = '2026-09-22T10:00:00.000Z'
const BETWEEN = '2026-09-22T18:00:00.000Z'
const LATER = '2026-09-23T10:00:00.000Z'

/** Longer than the write's settle, which is what the debounce is for. */
const AFTER_SETTLING = { timeout: 4000 }

/** A store holding what a device already had, dated. */
function deviceHolding(stored: null | StoredPreferences) {
  const storage = memoryStorage()
  const store = preferencesStore(storage)

  if (stored !== null) {
    store.writeStored(stored)
  }

  return store
}

function gatewayHolding(document: PreferencesDocument) {
  const write = vi.fn((sent: PreferencesDocument) => Promise.resolve(sent))

  return {
    gateway: { read: vi.fn(() => Promise.resolve(document)), write } satisfies PreferencesGateway,
    write,
  }
}

function Probe() {
  const { preferences, setPreferences, unsynced } = usePreferences()

  return (
    <div>
      <p data-testid="time-zone">{preferences.timeZone}</p>
      <p data-testid="unsynced">{unsynced ? 'unsynced' : 'synced'}</p>
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
          setPreferences(withTimeZone(preferences, 'Europe/Lisbon'))
        }}
        type="button"
      >
        change to Lisbon
      </button>
    </div>
  )
}

function settings(updatedAt: null | string, timeZone = 'Europe/Lisbon'): StoredPreferences {
  return { preferences: withTimeZone(DEFAULT_PREFERENCES, timeZone), updatedAt }
}

/**
 * What `settle` holds until the write under test hands over its own resolver.
 *
 * Throwing rather than doing nothing: a document settled before any write is
 * open is the test lying to itself about what it is exercising.
 */
function unresolved(document: PreferencesDocument): void {
  throw new Error(`nothing is waiting for ${String(document.etag)}`)
}

beforeEach(() => {
  stubSystemDarkMode(false)
})

describe('settings that follow the reader', () => {
  /*
   * The property every screen depends on: nothing waits. The device's values are
   * read synchronously before the store has been asked, so the first paint is
   * already the reader's own.
   */
  it('paints the device’s settings before the store has answered', () => {
    const { gateway } = gatewayHolding({ etag: '"1"', settings: settings(LATER, 'Asia/Tokyo') })

    render(
      <PreferencesProvider gateway={gateway} store={deviceHolding(settings(EARLIER))}>
        <Probe />
      </PreferencesProvider>,
    )

    expect(screen.getByTestId('time-zone')).toHaveTextContent('Europe/Lisbon')
  })

  it('takes the store’s settings when they were written later', async () => {
    const { gateway } = gatewayHolding({ etag: '"1"', settings: settings(LATER, 'Asia/Tokyo') })

    render(
      <PreferencesProvider gateway={gateway} store={deviceHolding(settings(EARLIER))}>
        <Probe />
      </PreferencesProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('time-zone')).toHaveTextContent('Asia/Tokyo')
    })
  })

  it('keeps the device’s when they were changed later', async () => {
    const { gateway } = gatewayHolding({ etag: '"1"', settings: settings(EARLIER, 'Asia/Tokyo') })

    render(
      <PreferencesProvider gateway={gateway} store={deviceHolding(settings(LATER))}>
        <Probe />
      </PreferencesProvider>,
    )

    await waitFor(() => {
      expect(gateway.read).toHaveBeenCalled()
    })
    expect(screen.getByTestId('time-zone')).toHaveTextContent('Europe/Lisbon')
  })

  /*
   * The first visit after this shipped. A device that has been holding settings
   * all along has recorded no instant, and must send them up against an empty
   * store rather than wait for the reader to touch a field.
   */
  it('sends what the device already had to a store that holds nothing', async () => {
    const { gateway, write } = gatewayHolding({ etag: null, settings: null })
    const store = deviceHolding(settings(null, 'Europe/Lisbon'))

    render(
      <PreferencesProvider gateway={gateway} store={store}>
        <Probe />
      </PreferencesProvider>,
    )

    await waitFor(() => {
      expect(write).toHaveBeenCalled()
    }, AFTER_SETTLING)
    expect(write.mock.calls[0]?.[0].settings?.preferences.timeZone).toBe('Europe/Lisbon')

    // Stamped, and stamped where the device can see it. An undated document is
    // refused by the endpoint — nothing could order it against another device's
    // — so a gateway mock that accepts one would let a 400 through to production
    // and tell a reader who had just arrived that their settings were stuck.
    expect(write.mock.calls[0]?.[0].settings?.updatedAt).not.toBeNull()
    expect(store.readStored().updatedAt).not.toBeNull()
  })

  /*
   * The other half of the same rule, and the direction that matters more: a
   * device holding settings it cannot date must not push them over settings
   * somebody really set somewhere else. A fresh install is exactly that device.
   */
  it('takes the store’s settings rather than publishing its own undated ones', async () => {
    const { gateway, write } = gatewayHolding({
      etag: '"1"',
      settings: settings(EARLIER, 'Asia/Tokyo'),
    })

    render(
      <PreferencesProvider gateway={gateway} store={deviceHolding(settings(null, 'Europe/Lisbon'))}>
        <Probe />
      </PreferencesProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('time-zone')).toHaveTextContent('Asia/Tokyo')
    })
    await new Promise((resolve) => {
      setTimeout(resolve, 1500)
    })

    expect(write).not.toHaveBeenCalled()
  })

  /*
   * A store that refuses the read leaves a never-synced device with nothing to
   * date its settings by, and it must not send them anyway: the endpoint would
   * refuse an undated document, which is a second failure reported for one
   * outage and a write nobody could have accepted.
   */
  it('sends nothing undated when the store would not answer the read', async () => {
    const write = vi.fn<PreferencesGateway['write']>(() => Promise.reject(new Error('down')))
    const gateway: PreferencesGateway = {
      read: vi.fn(() => Promise.reject(new Error('down'))),
      write,
    }

    render(
      <PreferencesProvider gateway={gateway} store={deviceHolding(settings(null))}>
        <Probe />
      </PreferencesProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('unsynced')).toHaveTextContent('unsynced')
    })
    await new Promise((resolve) => {
      setTimeout(resolve, 1500)
    })

    expect(write).not.toHaveBeenCalled()
  })

  it('carries a change to the store once it has settled', async () => {
    const { gateway, write } = gatewayHolding({ etag: '"1"', settings: settings(EARLIER) })

    render(
      <PreferencesProvider gateway={gateway} store={deviceHolding(settings(EARLIER))}>
        <Probe />
      </PreferencesProvider>,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'change zone' }))

    expect(screen.getByTestId('time-zone')).toHaveTextContent('Asia/Tokyo')

    await waitFor(() => {
      expect(write).toHaveBeenCalled()
    }, AFTER_SETTLING)

    const [sent] = write.mock.calls[0] ?? []

    // The version it was told to replace, not one it invented.
    expect(sent?.etag).toBe('"1"')
    expect(sent?.settings?.preferences.timeZone).toBe('Asia/Tokyo')
  })

  /*
   * A store that will not answer costs the reader nothing but the syncing. The
   * value they set is in effect — it was written to the device before anything
   * was sent — and every screen keeps working.
   */
  it('says so when the settings are not reaching the store, and keeps them in effect', async () => {
    const gateway: PreferencesGateway = {
      read: vi.fn(() => Promise.reject(new Error('down'))),
      write: vi.fn(() => Promise.reject(new Error('down'))),
    }

    render(
      <PreferencesProvider gateway={gateway} store={deviceHolding(settings(EARLIER))}>
        <Probe />
      </PreferencesProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('unsynced')).toHaveTextContent('unsynced')
    })
    expect(screen.getByTestId('time-zone')).toHaveTextContent('Europe/Lisbon')
  })

  // A test, and the screen shown when there is no session to prove anybody with.
  it('does nothing at all without a gateway', () => {
    render(
      <PreferencesProvider store={deviceHolding(settings(EARLIER))}>
        <Probe />
      </PreferencesProvider>,
    )

    expect(screen.getByTestId('time-zone')).toHaveTextContent('Europe/Lisbon')
    expect(screen.getByTestId('unsynced')).toHaveTextContent('synced')
  })

  /*
   * A device that already agrees with the store writes nothing. It used to write
   * on every load: the write pass ran before the read had answered, so it held
   * no version to name, asserted there was nothing stored, and was refused —
   * then resolved that refusal into a second request to say what was already
   * true.
   */
  it('writes nothing on a load where the store already agrees', async () => {
    const { gateway, write } = gatewayHolding({ etag: '"1"', settings: settings(LATER) })

    render(
      <PreferencesProvider gateway={gateway} store={deviceHolding(settings(LATER))}>
        <Probe />
      </PreferencesProvider>,
    )

    await waitFor(() => {
      expect(gateway.read).toHaveBeenCalled()
    })
    await new Promise((resolve) => {
      setTimeout(resolve, 1500)
    })

    expect(write).not.toHaveBeenCalled()
  })

  /*
   * The worst failure this sync can have, and the one it had. A write outlives
   * the value that started it: if the answer is compared against that value
   * rather than against what the device holds now, an edit made while the write
   * was in flight is overwritten by the document the write turned out to be
   * racing — and then never sent, because the version just recorded makes the
   * pending write look unnecessary. Nothing is reported, because nothing failed.
   */
  it('keeps an edit made while a write was in flight, and sends it', async () => {
    let settle: (document: PreferencesDocument) => void = unresolved
    const write = vi.fn<PreferencesGateway['write']>(
      () =>
        new Promise<PreferencesDocument>((resolve) => {
          settle = resolve
        }),
    )
    const gateway: PreferencesGateway = {
      read: vi.fn(() => Promise.resolve({ etag: '"1"', settings: settings(EARLIER) })),
      write,
    }

    render(
      <PreferencesProvider gateway={gateway} store={deviceHolding(settings(EARLIER))}>
        <Probe />
      </PreferencesProvider>,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'change zone' }))
    await waitFor(() => {
      expect(write).toHaveBeenCalledTimes(1)
    }, AFTER_SETTLING)

    // The reader changes something else while that write is still open.
    await userEvent.click(screen.getByRole('button', { name: 'change to Lisbon' }))
    expect(screen.getByTestId('time-zone')).toHaveTextContent('Europe/Lisbon')

    // And the write it was racing turns out to have been won by another device.
    settle({ etag: '"9"', settings: settings(BETWEEN, 'Pacific/Auckland') })

    // What the reader last set is still what they are looking at, and it is sent.
    await waitFor(() => {
      expect(write).toHaveBeenCalledTimes(2)
    }, AFTER_SETTLING)
    expect(screen.getByTestId('time-zone')).toHaveTextContent('Europe/Lisbon')
    expect(write.mock.calls[1]?.[0].settings?.preferences.timeZone).toBe('Europe/Lisbon')
  })
})
