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

export function encodePreferences(preferences: Preferences): string {
  return JSON.stringify(preferences)
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
