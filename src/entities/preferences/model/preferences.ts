import { isValidTimeZone } from '@/shared/lib/date'

import { type DailyTarget, dailyTargetFrom, DEFAULT_DAILY_TARGET } from './daily-target'

/**
 * The settings that change how hours are computed.
 *
 * The reader's language is deliberately not here: the message compiler already
 * owns it, and a second copy would be a second source of truth. The theme is
 * not here either — see `THEME_STORAGE_KEY` for why it needs its own key.
 */
export interface Preferences {
  readonly dailyTarget: DailyTarget
  /** An IANA time zone name. It decides which calendar day an entry lands on. */
  readonly timeZone: string
}

export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo'

export const PREFERENCES_STORAGE_KEY = 'preferences'

export const DEFAULT_PREFERENCES: Preferences = {
  dailyTarget: DEFAULT_DAILY_TARGET,
  timeZone: DEFAULT_TIME_ZONE,
}

/**
 * Settings with the instant they were last changed at.
 *
 * The instant is on the envelope rather than on `Preferences` itself: every
 * screen that reads settings is reading the reader's own numbers, and none of
 * them has any business with when those were last touched. It exists so two
 * devices holding the same settings can tell which of them wrote last — see
 * `reconcile.ts`.
 *
 * It is **null when this device has never recorded one**, and that is a third
 * state rather than an old date. It was the epoch at first, and two devices that
 * had both never synced then carried the same instant while holding different
 * settings: `reconcile` called that agreement, so neither ever adopted and the
 * two drifted apart in silence. Null says what is true — nothing here is known
 * to be from any particular moment — and lets the rule answer by provenance
 * instead of by an ordering that does not exist.
 */
export interface StoredPreferences {
  readonly preferences: Preferences
  /** An ISO instant, or null when this device has never recorded one. */
  readonly updatedAt: null | string
}

/**
 * Reads preferences back from storage.
 *
 * Anything unusable falls back to its default, field by field, so one damaged
 * value does not cost the reader the others. Unreadable JSON yields the
 * defaults outright.
 */
export function decodePreferences(stored: null | string): Preferences {
  const source = parseObject(stored)

  return {
    dailyTarget: dailyTargetFrom(source['dailyTarget']),
    timeZone: timeZoneFrom(source['timeZone']),
  }
}

/**
 * Reads the envelope back, from the device or from the store.
 *
 * The settings inside it go through `decodePreferences`, so one damaged field
 * still costs the reader only that field. An absent or unusable instant is null
 * rather than a date nobody wrote.
 */
export function decodeStoredPreferences(stored: null | string): StoredPreferences {
  const source = parseObject(stored)
  const updatedAt = source['updatedAt']

  return {
    preferences: decodePreferences(stored),
    updatedAt: usableInstant(updatedAt) ? updatedAt : null,
  }
}

export function encodePreferences(preferences: Preferences): string {
  return JSON.stringify(preferences)
}

export function encodeStoredPreferences(stored: StoredPreferences): string {
  return JSON.stringify({ ...stored.preferences, updatedAt: stored.updatedAt })
}

/** A copy of `preferences` with the daily target replaced. */
export function withDailyTarget(preferences: Preferences, dailyTarget: DailyTarget): Preferences {
  return { ...preferences, dailyTarget }
}

/** A copy of `preferences` with the time zone changed. */
export function withTimeZone(preferences: Preferences, timeZone: string): Preferences {
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError(`Not a recognised IANA time zone: ${timeZone}`)
  }

  return { ...preferences, timeZone }
}

function parseObject(stored: null | string): Record<string, unknown> {
  try {
    // Nothing stored parses as the empty string, which throws and lands in the
    // catch below — the same outcome as any other unreadable value.
    const parsed: unknown = JSON.parse(stored ?? '')

    // The check narrows `unknown` enough to spread. It carries no behaviour of
    // its own: spreading anything that is not an object yields no `dailyTarget`
    // or `timeZone` key, so every field would fall back regardless.
    return typeof parsed === 'object' && parsed !== null ? { ...parsed } : {}
  } catch {
    return {}
  }
}

function timeZoneFrom(source: unknown): string {
  return typeof source === 'string' && isValidTimeZone(source) ? source : DEFAULT_TIME_ZONE
}

/** An instant something could have been written at, rather than a string. */
function usableInstant(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) && value.includes('T')
}
