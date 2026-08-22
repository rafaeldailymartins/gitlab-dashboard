import { describe, expect, it } from 'vitest'

import type { DayTotal } from '@/entities/timelogs'

import { isoDate } from '@/shared/lib/date'

import { feedScale } from './feed-scale'

const SECONDS_PER_HOUR = 3600
const NO_TARGETS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }

function day(hours: number): DayTotal {
  return {
    date: isoDate('2026-08-20'),
    entryCount: 1,
    hours,
    items: [],
    seconds: hours * SECONDS_PER_HOUR,
  }
}

describe('feedScale', () => {
  it('is the longest day the reader configured', () => {
    expect(feedScale([day(2)], { 1: 8, 2: 8, 3: 8, 4: 8, 5: 6, 6: 0, 7: 0 })).toBe(8)
  })

  it('is the same for every row, whatever the day holds', () => {
    const target = { 1: 8, 2: 8, 3: 8, 4: 8, 5: 8, 6: 0, 7: 0 }

    expect(feedScale([day(2)], target)).toBe(feedScale([day(12)], target))
  })

  it('falls back to the busiest day loaded when no day has a target', () => {
    expect(feedScale([day(2), day(6.5)], NO_TARGETS)).toBe(6.5)
  })

  it('has nothing to scale when there is neither a target nor an hour', () => {
    expect(feedScale([], NO_TARGETS)).toBe(0)
  })

  it('reads a longer weekend target than weekday target as the reference', () => {
    expect(feedScale([], { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 10, 7: 0 })).toBe(10)
  })
})
