import { describe, expect, it } from 'vitest'

import { secondsToHours } from './duration'

describe('secondsToHours', () => {
  it('returns zero for no time logged', () => {
    expect(secondsToHours(0)).toBe(0)
  })

  it('converts whole hours exactly', () => {
    expect(secondsToHours(3600)).toBe(1)
    expect(secondsToHours(28_800)).toBe(8)
  })

  it('converts fractions of an hour', () => {
    expect(secondsToHours(1800)).toBe(0.5)
    expect(secondsToHours(2700)).toBe(0.75)
  })

  it('matches the precision GitLab displays', () => {
    // 6h42m, taken from a real timelog on invent-software/inventariofiscal#128.
    expect(secondsToHours(24_120)).toBe(6.7)
    expect(secondsToHours(24_300)).toBe(6.75)
  })

  it('rounds to two decimals', () => {
    expect(secondsToHours(100)).toBe(0.03)
    expect(secondsToHours(101)).toBe(0.03)
    expect(secondsToHours(89)).toBe(0.02)
  })

  it('rounds a half hundredth away from zero', () => {
    expect(secondsToHours(18)).toBe(0.01)
    expect(secondsToHours(-18)).toBe(-0.01)
  })

  it('supports negative durations, which correct a mistaken entry', () => {
    expect(secondsToHours(-3600)).toBe(-1)
    expect(secondsToHours(-24_120)).toBe(-6.7)
  })

  it('normalises a rounded-away negative to positive zero', () => {
    const result = secondsToHours(-1)

    expect(result).toBe(0)
    expect(Object.is(result, -0)).toBe(false)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects the non-finite duration %s',
    (value) => {
      expect(() => secondsToHours(value)).toThrow(TypeError)
    },
  )

  it('names the offending value in the error message', () => {
    expect(() => secondsToHours(Number.NaN)).toThrow(/must be finite/)
    expect(() => secondsToHours(Number.NaN)).toThrow(/NaN/)
    expect(() => secondsToHours(Number.POSITIVE_INFINITY)).toThrow(/Infinity/)
  })
})
