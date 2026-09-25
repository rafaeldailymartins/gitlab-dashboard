import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SEARCH_SETTLE_MS, useDebounced } from './use-debounced'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Lets the pending timer fire inside React's own batching. */
function wait(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('useDebounced', () => {
  // A box that starts empty has nothing to wait for, and a caller that renders
  // a skeleton until the first settle would draw one for no reason.
  it('answers with the first value at once', () => {
    const { result } = renderHook(() => useDebounced('ada', SEARCH_SETTLE_MS))

    expect(result.current).toBe('ada')
  })

  it('holds a change until it has stopped for the delay', () => {
    const { rerender, result } = renderHook(({ typed }) => useDebounced(typed, SEARCH_SETTLE_MS), {
      initialProps: { typed: '' },
    })

    rerender({ typed: 'a' })
    expect(result.current).toBe('')

    wait(SEARCH_SETTLE_MS)
    expect(result.current).toBe('a')
  })

  /*
   * The whole point, and the thing a naive implementation gets wrong by
   * restarting nothing: six keystrokes inside one delay must settle once, on
   * the last of them, not six times in a row at the end.
   */
  it('settles once on the last of a burst, not once per keystroke', () => {
    const { rerender, result } = renderHook(({ typed }) => useDebounced(typed, SEARCH_SETTLE_MS), {
      initialProps: { typed: '' },
    })
    const settled: string[] = []

    for (const typed of ['t', 'ta', 'tax', 'taxp', 'taxpl', 'taxplus']) {
      rerender({ typed })
      wait(SEARCH_SETTLE_MS - 1)
      settled.push(result.current)
    }

    // Nothing settled while the burst was still arriving.
    expect(settled).toEqual(['', '', '', '', '', ''])

    wait(SEARCH_SETTLE_MS)
    expect(result.current).toBe('taxplus')
  })

  it('does not settle a value the reader typed away from', () => {
    const { rerender, result } = renderHook(({ typed }) => useDebounced(typed, SEARCH_SETTLE_MS), {
      initialProps: { typed: '' },
    })

    rerender({ typed: 'ana' })
    wait(SEARCH_SETTLE_MS - 1)
    rerender({ typed: '' })
    wait(SEARCH_SETTLE_MS)

    expect(result.current).toBe('')
  })

  // The field is unmounted mid-burst — the teams dialog is closed, say — and a
  // timer that still fires would set state on nothing.
  it('drops a pending change when the caller goes away', () => {
    const { rerender, unmount } = renderHook(({ typed }) => useDebounced(typed, SEARCH_SETTLE_MS), {
      initialProps: { typed: '' },
    })

    rerender({ typed: 'ana' })
    unmount()

    expect(() => {
      vi.advanceTimersByTime(SEARCH_SETTLE_MS)
    }).not.toThrow()
    expect(vi.getTimerCount()).toBe(0)
  })
})
