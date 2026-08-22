import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'

import {
  type DailyTarget,
  DEFAULT_DAILY_TARGET,
  targetForDate,
  targetForDates,
  targetProgress,
  type TargetProgress,
  withWeekdayTarget,
} from '@/entities/preferences/model/daily-target'
import { datesBetween, isoDate, type IsoDate } from '@/shared/lib/date'

const feature = await loadFeature('features/domain/daily-target-and-balance.feature')

/** A fixed week, so a weekday name in a scenario means one specific date. */
const DATES = new Map<string, IsoDate>([
  ['Friday', isoDate('2026-08-21')],
  ['Monday', isoDate('2026-08-17')],
  ['Saturday', isoDate('2026-08-22')],
  ['Sunday', isoDate('2026-08-23')],
])

function dateFor(weekday: string): IsoDate {
  const date = DATES.get(weekday)

  if (date === undefined) {
    throw new Error(`The feature names a weekday the steps do not know: ${weekday}`)
  }

  return date
}

const WEEK = datesBetween(isoDate('2026-08-17'), isoDate('2026-08-23'))

interface Scratch {
  progress?: TargetProgress
  readHours?: number
  refused?: boolean
  target: DailyTarget
}

function freshScratch(): Scratch {
  return { target: DEFAULT_DAILY_TARGET }
}

describeFeature(feature, ({ Background, Scenario, ScenarioOutline }) => {
  let scratch = freshScratch()

  Background(({ Given }) => {
    Given('a reader who has not changed their targets', () => {
      scratch = freshScratch()
    })
  })

  ScenarioOutline('The default working week', ({ Then, When }, variables) => {
    const example = variables as { hours: string; weekday: string }

    When('the target for <weekday> is read', () => {
      scratch.readHours = targetForDate(scratch.target, dateFor(example.weekday))
    })

    Then('it is <hours> hours', () => {
      expect(scratch.readHours).toBe(Number(example.hours))
    })
  })

  Scenario("A week's target is the sum of its days", ({ Then, When }) => {
    When('the target for a whole week is read', () => {
      scratch.readHours = targetForDates(scratch.target, WEEK)
    })

    Then('it is 40 hours', () => {
      expect(scratch.readHours).toBe(40)
    })
  })

  Scenario('Shortening one weekday', ({ And, Then, When }) => {
    When('the target for Friday is set to 6 hours', () => {
      scratch.target = withWeekdayTarget(scratch.target, 5, 6)
    })

    Then('the target for Friday is 6 hours', () => {
      expect(targetForDate(scratch.target, dateFor('Friday'))).toBe(6)
    })

    And('the target for Monday is still 8 hours', () => {
      expect(targetForDate(scratch.target, dateFor('Monday'))).toBe(8)
    })

    And('the target for a whole week is 38 hours', () => {
      expect(targetForDates(scratch.target, WEEK)).toBe(38)
    })
  })

  ScenarioOutline('Refusing a target a day could not hold', ({ Then, When }, variables) => {
    const example = variables as { hours: string }

    When('the target for Monday is set to <hours> hours', () => {
      try {
        scratch.target = withWeekdayTarget(scratch.target, 1, Number(example.hours))
        scratch.refused = false
      } catch {
        scratch.refused = true
      }
    })

    Then('the change is refused', () => {
      expect(scratch.refused).toBe(true)
      expect(scratch.target).toEqual(DEFAULT_DAILY_TARGET)
    })
  })

  Scenario('Time logged on a day with no target counts as above target', ({ And, Then, When }) => {
    When('2 hours are logged on a Sunday', () => {
      scratch.progress = targetProgress(2, targetForDate(scratch.target, dateFor('Sunday')))
    })

    Then('the balance is 2 hours above target', () => {
      expect(scratch.progress?.balanceHours).toBe(2)
      expect(scratch.progress?.isMet).toBe(true)
    })

    And('there is no percentage to report', () => {
      expect(scratch.progress?.ratio).toBeNull()
    })
  })
})
