import { describe, expect, it } from 'vitest'

import { dayParam, monthParam, monthParamOf, monthStart } from './address'
import { isoDate } from './date'

describe('dayParam', () => {
  it('keeps a real calendar date', () => {
    expect(dayParam('2026-08-21')).toBe('2026-08-21')
  })

  it('keeps a date after today, for the screen to clamp in the reader zone', () => {
    expect(dayParam('2099-01-01')).toBe('2099-01-01')
  })

  it.each([
    { label: 'nothing', value: undefined },
    { label: 'a day that does not exist', value: '2026-02-30' },
    { label: 'something that is not a date', value: 'yesterday' },
    { label: 'a number', value: 20_260_821 },
  ])('reads $label as no day', ({ value }) => {
    expect(dayParam(value)).toBeUndefined()
  })
})

describe('monthParam', () => {
  it('keeps a real month', () => {
    expect(monthParam('2026-08')).toBe('2026-08')
  })

  it.each([
    { label: 'nothing', value: undefined },
    { label: 'a month that does not exist', value: '2026-13' },
    { label: 'a whole date', value: '2026-08-01' },
    { label: 'something that is not a month', value: 'august' },
    { label: 'a number', value: 202_608 },
  ])('reads $label as no month', ({ value }) => {
    expect(monthParam(value)).toBeUndefined()
  })
})

describe('monthStart', () => {
  it('is the first of the month', () => {
    expect(monthStart('2026-08')).toBe('2026-08-01')
  })
})

describe('monthParamOf', () => {
  it('names the month a day falls in', () => {
    expect(monthParamOf(isoDate('2026-08-21'))).toBe('2026-08')
  })
})
