import { useEffect, useMemo, useRef, useState } from 'react'

import type { PreferencesDocument, PreferencesGateway } from '../model/ports'
import type { StoredPreferences } from '../model/preferences'

import { reconcile } from '../model/reconcile'

/**
 * How long a change waits before it is carried anywhere.
 *
 * The weekday targets are spinbuttons: setting one number is several changes,
 * and a write per change would be several requests to say one thing. Long
 * enough to collect a field being typed, short enough that closing the laptop
 * straight after does not lose it.
 */
const SETTLE_MS = 800

export interface Syncing {
  /** True once a read or a write failed and nothing has succeeded since. */
  readonly failed: boolean
}

/**
 * What the store last handed over.
 *
 * Refs behind methods rather than the refs themselves. Changing either must not
 * paint, so they cannot be state; and handing the refs to the passes below would
 * have each assigning into a parameter, which is the kind of shared mutable that
 * makes two effects hard to reason about separately.
 */
interface Held {
  /** The version the next write replaces, or null to assert there is none. */
  readonly etag: () => null | string
  /** True when the store already holds a document stamped this instant. */
  readonly holds: (updatedAt: null | string) => boolean
  readonly remember: (document: PreferencesDocument) => void
}

interface Pass {
  readonly gateway: null | PreferencesGateway
  readonly held: Held
  /** What the device holds now, which is not always what a request carried. */
  readonly latest: { current: StoredPreferences }
  readonly onAdopt: (settings: StoredPreferences) => void
  readonly setFailed: (failed: boolean) => void
}

interface SyncInput {
  /** Null when there is nobody to sync for — a test, or the unconfigured app. */
  readonly gateway: null | PreferencesGateway
  /** Called when the store's document should replace the device's. */
  readonly onAdopt: (settings: StoredPreferences) => void
  readonly settings: StoredPreferences
}

/**
 * Carries the reader's settings to their other devices, behind what is on
 * screen.
 *
 * Nothing here is on the render path. The device's own values were read
 * synchronously before this ran and are what every screen is already painting;
 * this reads the store once, reconciles, and then writes through on change. A
 * reader with no session, or a store that will not answer, is left with exactly
 * what they had before any of this existed.
 */
export function usePreferencesSync({ gateway, onAdopt, settings }: SyncInput): Syncing {
  const [failed, setFailed] = useState(false)
  // State rather than a ref, because the write pass must not run before the
  // store has been asked and has to re-run once it has.
  const [asked, setAsked] = useState(false)
  const held = useHeld()
  const latest = useRef(settings)

  latest.current = settings

  useFirstRead({ gateway, held, latest, onAdopt, setAsked, setFailed })
  useWriteThrough({ asked, gateway, held, latest, onAdopt, setFailed, settings })

  return { failed }
}

/**
 * What the device should hold once the store has answered, or null to leave it.
 *
 * Read through `latest` rather than through whatever was sent, because a request
 * outlives the value that started it. The write pass used to compare the answer
 * against its own snapshot with a plain inequality, and that lost the reader's
 * newest change outright: an edit made while a write was in flight was
 * overwritten by the document that write turned out to be racing, and then never
 * sent, because the version just recorded made the pending write look
 * unnecessary. Nothing was reported, because nothing had failed.
 *
 * Two acts end here, because both are "what this device holds from now on".
 * `adopt` takes the other device's document. `push` from a device that has
 * recorded no instant takes its own settings and **stamps** them: an undated
 * document is not storable — nothing could order it, and the endpoint refuses
 * one — and reaching an empty store is the moment those settings are published,
 * so it is the moment they are dated. Writing is still the write pass's job; the
 * stamp is what gives it something to carry.
 */
function settling(
  latest: StoredPreferences,
  document: PreferencesDocument,
): null | StoredPreferences {
  const { settings } = document
  const answer = reconcile(latest, settings)

  if (answer === 'adopt') {
    return settings
  }

  return answer === 'push' && latest.updatedAt === null
    ? { preferences: latest.preferences, updatedAt: new Date().toISOString() }
    : null
}

/**
 * The store's opinion, once, and what to do with it.
 *
 * Deliberately not skipped when the device has recorded nothing. Such a device
 * adopts rather than competes — see `reconcile` — and pushes only against a
 * store that holds nothing at all, which is what carries settings a device was
 * already holding before any of this existed.
 */
function useFirstRead({
  gateway,
  held,
  latest,
  onAdopt,
  setAsked,
  setFailed,
}: Pass & { readonly setAsked: (asked: boolean) => void }): void {
  useEffect(() => {
    if (gateway === null) {
      return
    }

    const aborter = new AbortController()

    void gateway
      .read(aborter.signal)
      .then((document) => {
        held.remember(document)
        setFailed(false)

        const taking = settling(latest.current, document)

        if (taking !== null) {
          onAdopt(taking)
        }
      })
      .catch(() => {
        // An abort is this component going away, not a failure the reader has
        // any business hearing about.
        if (!aborter.signal.aborted) {
          setFailed(true)
        }
      })
      .finally(() => {
        if (!aborter.signal.aborted) {
          // Asked, whether or not it answered. A store that refused is not a
          // reason to sit on the reader's changes forever.
          setAsked(true)
        }
      })

    return () => {
      aborter.abort()
    }
  }, [gateway, held, latest, onAdopt, setAsked, setFailed])
}

function useHeld(): Held {
  const etag = useRef<null | string>(null)
  const settled = useRef<null | string>(null)

  return useMemo(
    () => ({
      etag: () => etag.current,
      holds: (updatedAt) => updatedAt !== null && settled.current === updatedAt,
      remember: (document) => {
        etag.current = document.etag
        settled.current = document.settings?.updatedAt ?? null
      },
    }),
    [],
  )
}

/**
 * Every change, once it has settled — and not before the store has been asked.
 *
 * Waiting for the read is what stops a device that already agrees with the store
 * from writing on every load: until the store has answered there is no version
 * to name, so the write would assert nothing is stored, be refused, and be
 * resolved into a second request to say what was already true.
 */
function useWriteThrough({
  asked,
  gateway,
  held,
  latest,
  onAdopt,
  setFailed,
  settings,
}: Pass & { readonly asked: boolean; readonly settings: StoredPreferences }): void {
  useEffect(() => {
    // An undated document is not sendable: the endpoint refuses one, and
    // reporting that refusal would tell a reader who has never set anything that
    // their settings are not reaching them. The read pass stamps a device whose
    // settings are worth publishing, and the reader's own first edit stamps the
    // rest; either way this runs with an instant or not at all.
    if (gateway === null || !asked || settings.updatedAt === null) {
      return
    }

    if (held.holds(settings.updatedAt)) {
      return
    }

    const timer = setTimeout(() => {
      void gateway
        .write({ etag: held.etag(), settings })
        .then((document) => {
          held.remember(document)
          setFailed(false)

          const taking = settling(latest.current, document)

          if (taking !== null) {
            onAdopt(taking)
          }
        })
        .catch(() => {
          setFailed(true)
        })
    }, SETTLE_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [asked, gateway, held, latest, onAdopt, setFailed, settings])
}
