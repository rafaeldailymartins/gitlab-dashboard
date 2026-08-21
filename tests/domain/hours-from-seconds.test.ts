import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'

import { secondsToHours } from '@/entities/timelog/model/duration'

const feature = await loadFeature('features/domain/hours-from-seconds.feature')

/**
 * vitest-cucumber types example rows as `{ [key: string]: any }`, so narrow
 * once here and keep the rest of the file fully typed.
 */
interface ConversionExample {
  hours: string
  seconds: string
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  ScenarioOutline('Converting a logged duration to hours', ({ Given, Then, When }, variables) => {
    const example = variables as ConversionExample
    let seconds = 0
    let hours = 0

    Given('a timelog of <seconds> seconds', () => {
      seconds = Number(example.seconds)
    })

    When('the duration is converted to hours', () => {
      hours = secondsToHours(seconds)
    })

    Then('the result is <hours> hours', () => {
      expect(hours).toBe(Number(example.hours))
    })
  })

  Scenario('Rejecting a duration that is not a number', ({ Given, Then, When }) => {
    let seconds = 0
    let failure: unknown

    Given('a timelog of an unknown duration', () => {
      seconds = Number.NaN
    })

    When('the duration is converted to hours', () => {
      try {
        secondsToHours(seconds)
      } catch (error: unknown) {
        failure = error
      }
    })

    Then('the conversion is rejected as invalid', () => {
      expect(failure).toBeInstanceOf(TypeError)
    })
  })
})
