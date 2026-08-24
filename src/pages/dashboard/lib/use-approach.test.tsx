import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useApproach } from './use-approach'

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void

function Sentinel({
  enabled,
  onApproach,
}: {
  readonly enabled: boolean
  readonly onApproach: () => void
}) {
  const ref = useApproach(onApproach, enabled)

  return <div data-testid="sentinel" ref={ref} />
}

/** Stands in for the browser's observer, so a test can decide what came into view. */
function stubObserver() {
  const state = { callbacks: [] as ObserverCallback[], disconnects: 0, observed: 0 }

  class FakeObserver {
    constructor(callback: ObserverCallback) {
      state.callbacks.push(callback)
    }

    disconnect() {
      state.disconnects += 1
    }

    observe() {
      state.observed += 1
    }
  }

  vi.stubGlobal('IntersectionObserver', FakeObserver)

  return state
}

beforeEach(() => {
  stubObserver()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useApproach', () => {
  it('watches the element it was given', () => {
    const state = stubObserver()

    render(<Sentinel enabled onApproach={vi.fn()} />)

    expect(state.observed).toBe(1)
  })

  it('calls back when the element comes into view', () => {
    const state = stubObserver()
    const onApproach = vi.fn()

    render(<Sentinel enabled onApproach={onApproach} />)
    state.callbacks.at(0)?.([{ isIntersecting: true }])

    expect(onApproach).toHaveBeenCalledTimes(1)
  })

  it('stays quiet while the element is still out of view', () => {
    const state = stubObserver()
    const onApproach = vi.fn()

    render(<Sentinel enabled onApproach={onApproach} />)
    state.callbacks.at(0)?.([{ isIntersecting: false }])

    expect(onApproach).not.toHaveBeenCalled()
  })

  it('watches nothing when there is nothing older to ask for', () => {
    const state = stubObserver()

    render(<Sentinel enabled={false} onApproach={vi.fn()} />)

    expect(state.observed).toBe(0)
  })

  it('calls the newest callback, not the one it was mounted with', () => {
    const state = stubObserver()
    const stale = vi.fn()
    const fresh = vi.fn()

    const view = render(<Sentinel enabled onApproach={stale} />)
    view.rerender(<Sentinel enabled onApproach={fresh} />)
    state.callbacks.at(0)?.([{ isIntersecting: true }])

    // One observer for the whole mount: a new callback must not rebuild it.
    expect(state.callbacks).toHaveLength(1)
    expect(fresh).toHaveBeenCalledTimes(1)
    expect(stale).not.toHaveBeenCalled()
  })

  it('stops watching when the element goes away', () => {
    const state = stubObserver()

    render(<Sentinel enabled onApproach={vi.fn()} />).unmount()

    expect(state.disconnects).toBe(1)
  })
})
