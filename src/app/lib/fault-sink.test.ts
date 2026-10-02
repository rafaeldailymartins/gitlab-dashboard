import { describe, expect, it, vi } from 'vitest'

import { faultSink } from './fault-sink'

const QUERY = { origin: 'query' }

describe('faultSink', () => {
  it('holds faults until a reporter arrives, then hands them over in order', () => {
    const sink = faultSink()
    const first = new Error('first')
    const second = new Error('second')
    const reporter = vi.fn()

    sink.report(first, QUERY)
    sink.report(second, { origin: 'route' })
    sink.install(reporter)

    expect(reporter.mock.calls).toEqual([
      [first, QUERY],
      [second, { origin: 'route' }],
    ])
  })

  it('reports straight through once a reporter is installed', () => {
    const sink = faultSink()
    const reporter = vi.fn()
    const error = new Error('later')

    sink.install(reporter)
    sink.report(error, QUERY)

    expect(reporter).toHaveBeenCalledExactlyOnceWith(error, QUERY)
  })

  it('keeps the newest faults when more arrive than it holds', () => {
    const sink = faultSink(2)
    const reporter = vi.fn()

    for (const name of ['a', 'b', 'c']) {
      sink.report(new Error(name), QUERY)
    }

    sink.install(reporter)

    expect(reporter.mock.calls.map(([error]) => (error as Error).message)).toEqual(['b', 'c'])
  })

  it('holds ten by default', () => {
    const sink = faultSink()
    const reporter = vi.fn()

    for (let index = 0; index < 11; index += 1) {
      sink.report(new Error(String(index)), QUERY)
    }

    sink.install(reporter)

    expect(reporter).toHaveBeenCalledTimes(10)
    expect((reporter.mock.calls[0]?.[0] as Error).message).toBe('1')
  })

  it('swallows a reporter that throws, so reporting never breaks the app', () => {
    const sink = faultSink()

    sink.install(() => {
      throw new Error('the tracker is down')
    })

    expect(() => {
      sink.report(new Error('fault'), QUERY)
    }).not.toThrow()
  })

  it('drops what it holds when told reporting will never arrive', () => {
    const sink = faultSink()
    const reporter = vi.fn()

    sink.report(new Error('early'), QUERY)
    sink.abandon()
    sink.report(new Error('after'), QUERY)
    sink.install(reporter)

    expect(reporter).not.toHaveBeenCalled()
  })
})
