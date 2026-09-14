import { describe, expect, it } from 'vitest'

import { isoDate } from '@/shared/lib/date'

import { monthDateOf, shiftMonth, teamSearchFrom } from './search-params'

const TODAY = isoDate('2026-09-01')

describe('teamSearchFrom', () => {
  it('reads a group and a month out of an address', () => {
    expect(teamSearchFrom({ group: 'acme/squad', month: '2026-05' }, TODAY)).toEqual({
      by: 'days',
      group: 'acme/squad',
      month: '2026-05',
    })
  })

  it('reads the column axis, defaulting to days', () => {
    expect(teamSearchFrom({ by: 'weeks' }, TODAY).by).toBe('weeks')
    expect(teamSearchFrom({ by: 'fortnights' }, TODAY).by).toBe('days')
    expect(teamSearchFrom({}, TODAY).by).toBe('days')
  })

  it('leaves the group empty rather than inventing one', () => {
    expect(teamSearchFrom({}, TODAY).group).toBe('')
    expect(teamSearchFrom({ group: 42 }, TODAY).group).toBe('')
  })

  it.each(['2026-13', '2026-00', 'not-a-month', '2026', '2026-5', 42, null, undefined])(
    'recovers to this month rather than failing on %o',
    (month) => {
      expect(teamSearchFrom({ month }, TODAY).month).toBe('2026-09')
    },
  )

  it('accepts a month at either end of a year', () => {
    expect(teamSearchFrom({ month: '2026-01' }, TODAY).month).toBe('2026-01')
    expect(teamSearchFrom({ month: '2026-12' }, TODAY).month).toBe('2026-12')
  })
})

describe('monthDateOf', () => {
  it('names the first day of the month', () => {
    expect(monthDateOf(teamSearchFrom({ month: '2026-05' }, TODAY))).toBe('2026-05-01')
  })
})

describe('shiftMonth', () => {
  it('moves within a year', () => {
    expect(shiftMonth('2026-05', -1)).toBe('2026-04')
    expect(shiftMonth('2026-05', 1)).toBe('2026-06')
  })

  it('crosses a year boundary backwards', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('crosses a year boundary forwards', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })

  it('moves further than a year', () => {
    expect(shiftMonth('2026-05', -13)).toBe('2025-04')
    expect(shiftMonth('2026-05', 13)).toBe('2027-06')
  })

  it('stays where it is when asked for no move', () => {
    expect(shiftMonth('2026-05', 0)).toBe('2026-05')
  })
})
