import { describe, expect, it } from 'vitest'

import { DEFAULT_DAILY_TARGET, withWeekdayTarget } from './daily-target'
import {
  decodePreferences,
  DEFAULT_PREFERENCES,
  DEFAULT_TIME_ZONE,
  encodePreferences,
  withDailyTarget,
  withTimeZone,
} from './preferences'

describe('decodePreferences', () => {
  it('uses the defaults when nothing was ever stored', () => {
    expect(decodePreferences(null)).toEqual(DEFAULT_PREFERENCES)
  })

  it.each(['', 'not json', '{', '{"timeZone":}'])(
    'uses the defaults for the unreadable value %o',
    (stored) => {
      expect(decodePreferences(stored)).toEqual(DEFAULT_PREFERENCES)
    },
  )

  it.each(['42', '"a string"', 'null', 'true', '[1,2,3]'])(
    'uses the defaults for the JSON value %s, which is not a preferences object',
    (stored) => {
      expect(decodePreferences(stored)).toEqual(DEFAULT_PREFERENCES)
    },
  )

  it('reads back what it wrote', () => {
    const preferences = withTimeZone(
      withDailyTarget(DEFAULT_PREFERENCES, withWeekdayTarget(DEFAULT_DAILY_TARGET, 5, 6)),
      'Europe/Lisbon',
    )

    expect(decodePreferences(encodePreferences(preferences))).toEqual(preferences)
  })

  it('falls back on an unrecognised time zone but keeps the target', () => {
    const stored = JSON.stringify({ dailyTarget: { 1: 6 }, timeZone: 'Mars/Olympus' })
    const preferences = decodePreferences(stored)

    expect(preferences.timeZone).toBe(DEFAULT_TIME_ZONE)
    expect(preferences.dailyTarget[1]).toBe(6)
  })

  it('falls back on a damaged target but keeps the time zone', () => {
    const stored = JSON.stringify({ dailyTarget: 'eight hours', timeZone: 'Asia/Tokyo' })
    const preferences = decodePreferences(stored)

    expect(preferences.timeZone).toBe('Asia/Tokyo')
    expect(preferences.dailyTarget).toEqual(DEFAULT_DAILY_TARGET)
  })

  it('fills in a field that is absent entirely', () => {
    const preferences = decodePreferences(JSON.stringify({ timeZone: 'Asia/Tokyo' }))

    expect(preferences.dailyTarget).toEqual(DEFAULT_DAILY_TARGET)
  })

  it('ignores fields it does not know about', () => {
    const stored = JSON.stringify({ colour: 'purple', timeZone: 'Asia/Tokyo' })

    expect(decodePreferences(stored).timeZone).toBe('Asia/Tokyo')
  })
})

describe('withTimeZone', () => {
  it('changes the time zone', () => {
    expect(withTimeZone(DEFAULT_PREFERENCES, 'Asia/Tokyo').timeZone).toBe('Asia/Tokyo')
  })

  it('leaves the original untouched', () => {
    withTimeZone(DEFAULT_PREFERENCES, 'Asia/Tokyo')

    expect(DEFAULT_PREFERENCES.timeZone).toBe(DEFAULT_TIME_ZONE)
  })

  it('keeps the daily target', () => {
    const changed = withTimeZone(DEFAULT_PREFERENCES, 'Asia/Tokyo')

    expect(changed.dailyTarget).toEqual(DEFAULT_DAILY_TARGET)
  })

  it.each(['Mars/Olympus', '', 'America/Sao Paulo'])(
    'rejects the unrecognised zone %o rather than storing it',
    (timeZone) => {
      expect(() => withTimeZone(DEFAULT_PREFERENCES, timeZone)).toThrow(RangeError)
    },
  )

  it('names the offending zone when it rejects one', () => {
    expect(() => withTimeZone(DEFAULT_PREFERENCES, 'Mars/Olympus')).toThrow('Mars/Olympus')
    expect(() => withTimeZone(DEFAULT_PREFERENCES, 'Mars/Olympus')).toThrow(
      /not a recognised iana time zone/i,
    )
  })
})

describe('withDailyTarget', () => {
  it('replaces the target', () => {
    const target = withWeekdayTarget(DEFAULT_DAILY_TARGET, 3, 4)

    expect(withDailyTarget(DEFAULT_PREFERENCES, target).dailyTarget).toEqual(target)
  })

  it('keeps the time zone', () => {
    const target = withWeekdayTarget(DEFAULT_DAILY_TARGET, 3, 4)

    expect(withDailyTarget(DEFAULT_PREFERENCES, target).timeZone).toBe(DEFAULT_TIME_ZONE)
  })
})
