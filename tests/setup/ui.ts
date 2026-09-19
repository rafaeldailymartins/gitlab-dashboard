import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

/**
 * Names the source of an unhandled rejection, which the runner will not.
 *
 * This suite has twice reported a failure as `Unhandled Rejection: Promise
 * unknown:1:11` rather than as a failed assertion — both times with `bun run
 * test` sharing a shell with other gates, never in a dedicated run, and never
 * reproducibly since. The report is unattributable on its own: it names a
 * promise and not the code that made it, and the `ui` project sets
 * `isolate: false`, so a rejection created in one file can surface while another
 * is running.
 *
 * So this does the one thing that turns the next occurrence into evidence: it
 * records which test file was running and prints the rejection's own stack. It
 * changes no outcome — the listener does not call `preventDefault`, so the
 * runner still fails the run exactly as it did before.
 */
let running = 'before any test'

beforeEach((context) => {
  running = context.task.file.name
})

globalThis.addEventListener('unhandledrejection', (event) => {
  const reason: unknown = event.reason

  // `no-console` is an error everywhere in `src/`; this is test scaffolding, and
  // printing is the whole purpose. The rule is disabled here rather than
  // configured away, so it stays an exception somebody has to justify.
  // eslint-disable-next-line no-console
  console.error(
    `Unhandled rejection while running ${running}:`,
    reason instanceof Error ? (reason.stack ?? reason.message) : reason,
  )
})

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
