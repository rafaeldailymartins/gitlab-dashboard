import { act } from '@testing-library/react'
import { vi } from 'vitest'

type SchemeListener = (event: MediaQueryListEvent) => void

/**
 * Replaces `matchMedia` so a test can decide what the operating system asks
 * for, and change its mind while the component is mounted.
 */
export function stubSystemDarkMode(prefersDark: boolean) {
  const listeners = new Set<SchemeListener>()
  let matches = prefersDark

  vi.stubGlobal('matchMedia', (media: string) => ({
    addEventListener: (_type: string, listener: SchemeListener) => {
      listeners.add(listener)
    },
    get matches() {
      return matches
    },
    media,
    removeEventListener: (_type: string, listener: SchemeListener) => {
      listeners.delete(listener)
    },
  }))

  return {
    /** Simulates the reader changing their system-wide colour scheme. */
    change(nextPrefersDark: boolean) {
      matches = nextPrefersDark

      act(() => {
        for (const listener of listeners) {
          listener({ matches: nextPrefersDark } as MediaQueryListEvent)
        }
      })
    },
  }
}
