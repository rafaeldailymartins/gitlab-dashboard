import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { addDays, type IsoDate, spanInstantsIn, toIsoDate } from './date'

/**
 * `spanInstantsIn` over any day in zones chosen for what they do to a day.
 *
 * São Paulo advanced its clocks at midnight until 2019, so some of its days
 * began at 01:00. Lord Howe moves by half an hour, Chatham sits at +12:45,
 * Kiritimati at +14 and Pago Pago at -11 — the two ends of the offsets there
 * are. Casablanca suspends its summer time for Ramadan, twice a year.
 */
const ZONES = [
  'UTC',
  'America/Sao_Paulo',
  'America/St_Johns',
  'Europe/London',
  'Africa/Casablanca',
  'Asia/Kolkata',
  'Asia/Tehran',
  'Australia/Lord_Howe',
  'Pacific/Chatham',
  'Pacific/Kiritimati',
  'Pacific/Pago_Pago',
] as const

const dayArbitrary: fc.Arbitrary<IsoDate> = fc
  .date({
    max: new Date('2035-12-31T00:00:00Z'),
    min: new Date('1990-01-01T00:00:00Z'),
    noInvalidDate: true,
  })
  .map((instant) => toIsoDate(instant, 'UTC'))

const zoneArbitrary = fc.constantFrom(...ZONES)

/** Microseconds since the epoch, from an ISO string carrying up to six decimals. */
function microsecondsOf(iso: string): bigint {
  const [whole = '', fraction = ''] = iso.replace(/Z$/u, '').split('.')

  return BigInt(Date.parse(`${whole}Z`)) * 1000n + BigInt(fraction.padEnd(6, '0'))
}

describe('spanInstantsIn, for any day in any zone', () => {
  it('opens at an instant of that day, right after an instant of the one before', () => {
    fc.assert(
      fc.property(dayArbitrary, zoneArbitrary, (day, zone) => {
        const opens = new Date(spanInstantsIn(day, day, zone).from)

        expect(toIsoDate(opens, zone)).toBe(day)
        expect(toIsoDate(new Date(opens.getTime() - 1), zone)).toBe(addDays(day, -1))
      }),
    )
  })

  it('closes on that same day', () => {
    fc.assert(
      fc.property(dayArbitrary, zoneArbitrary, (day, zone) => {
        expect(toIsoDate(new Date(spanInstantsIn(day, day, zone).to), zone)).toBe(day)
      }),
    )
  })

  it('leaves exactly one microsecond between a day and the next', () => {
    fc.assert(
      fc.property(dayArbitrary, zoneArbitrary, (day, zone) => {
        const closes = microsecondsOf(spanInstantsIn(day, day, zone).to)
        const next = addDays(day, 1)
        const opens = microsecondsOf(spanInstantsIn(next, next, zone).from)

        expect(opens - closes).toBe(1n)
      }),
    )
  })

  it('spans a run of days from the first day’s opening to the last day’s close', () => {
    fc.assert(
      fc.property(dayArbitrary, fc.nat(40), zoneArbitrary, (first, length, zone) => {
        const last = addDays(first, length)

        expect(spanInstantsIn(first, last, zone)).toEqual({
          from: spanInstantsIn(first, first, zone).from,
          to: spanInstantsIn(last, last, zone).to,
        })
      }),
    )
  })
})
