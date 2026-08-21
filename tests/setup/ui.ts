import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing Library's auto-cleanup only runs when the test framework exposes a
// global `afterEach`; registering it explicitly keeps tests isolated whether or
// not globals are enabled.
afterEach(() => {
  cleanup()
})
