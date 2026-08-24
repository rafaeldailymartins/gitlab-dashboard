import { describe, expect, it, vi } from 'vitest'

import { singleFlight } from './single-flight'

describe('singleFlight', () => {
  it('runs the operation once for a burst of callers', async () => {
    const gate = Promise.withResolvers<string>()
    const operation = vi.fn(() => gate.promise)
    const run = singleFlight(operation)

    const results = [run(), run(), run(), run()]
    gate.resolve('value')

    await expect(Promise.all(results)).resolves.toEqual(['value', 'value', 'value', 'value'])
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('starts a new run once the previous one settled', async () => {
    const operation = vi.fn(() => Promise.resolve('value'))
    const run = singleFlight(operation)

    await run()
    await run()

    expect(operation).toHaveBeenCalledTimes(2)
  })

  it('gives every caller in a burst the same failure', async () => {
    const gate = Promise.withResolvers<string>()
    const operation = vi.fn(() => gate.promise)
    const run = singleFlight(operation)

    const settled = Promise.allSettled([run(), run(), run()])
    gate.reject(new Error('no'))
    const outcomes = await settled

    expect(outcomes.every((outcome) => outcome.status === 'rejected')).toBe(true)
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('does not remember a failure, so the next caller may try again', async () => {
    const operation = vi.fn(() => Promise.reject(new Error('first')))
    const run = singleFlight(operation)

    await expect(run()).rejects.toThrow('first')

    operation.mockImplementation(() => Promise.resolve('recovered') as Promise<never>)

    await expect(run()).resolves.toBe('recovered')
  })

  it('does not remember a result either: it deduplicates, it does not cache', async () => {
    let calls = 0
    const run = singleFlight(() => {
      calls += 1

      return Promise.resolve(calls)
    })

    await expect(run()).resolves.toBe(1)
    await expect(run()).resolves.toBe(2)
  })
})
