import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing Library's automatic cleanup only registers when the test framework
// exposes a global `afterEach`; Vitest runs without global injection here, so
// it is registered explicitly.
afterEach(() => {
  cleanup()

  // Preferences and the active language are stored per device. Leaving them
  // behind would let one test decide what the next one starts from.
  //
  // Guarded because a test may be simulating a browser that denies storage
  // access, and cleanup must not be the thing that fails.
  try {
    globalThis.localStorage.clear()
  } catch {
    /* the test replaced storage with one that refuses; nothing to clear */
  }

  document.documentElement.className = ''
  document.documentElement.lang = ''
})
