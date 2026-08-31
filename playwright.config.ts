import { defineConfig, devices } from '@playwright/test'
import { defineBddConfig } from 'playwright-bdd'

import { ACCEPTANCE_ORIGIN, ACCEPTANCE_PORT } from './tests/e2e/support/origin'

/**
 * The acceptance suite runs the Gherkin features in `features/acceptance`
 * against a real browser. `bddgen` turns each `.feature` into a Playwright spec
 * before the run; `bun run test:e2e` does both steps.
 */
const testDir = defineBddConfig({
  features: 'features/acceptance/**/*.feature',
  outputDir: '.features-gen',
  steps: 'tests/e2e/steps/**/*.ts',
})

const isCi = Boolean(process.env['CI'])

/**
 * Chromium alone locally, all three in CI.
 *
 * A local run is for the change in front of you; 153 scenarios in three engines
 * is for the merge. Nothing ships unverified — the pipeline runs the matrix —
 * and one engine is still a whole engine: `--project=webkit` when you want it.
 */
const BROWSERS = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
]

export default defineConfig({
  forbidOnly: isCi,
  fullyParallel: true,
  projects: isCi ? BROWSERS : BROWSERS.slice(0, 1),
  reporter: isCi ? [['html', { open: 'never' }], ['list']] : [['list']],
  retries: isCi ? 1 : 0,
  testDir,
  use: {
    baseURL: ACCEPTANCE_ORIGIN,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    /**
     * The built bundle, not the dev server.
     *
     * Every browser used to share one Vite instance that transformed modules on
     * demand, which made the suite both slow and worker-bound: the default
     * worker count put more concurrent page loads on it than it could serve
     * inside a five-second expectation, and 25 scenarios failed for that reason
     * alone. Serving the build costs one `vite build` per run and pays for it
     * several times over — and it has the side benefit of exercising the
     * artefact that actually deploys rather than a development transform of it.
     *
     * The build runs on Bun; the server does not. Under `bun --bun`, Vite's
     * preview server uses Bun's `node:http` compatibility layer, which dies with
     * `ERR_STREAM_WRITE_AFTER_END` when a response is written after its
     * connection closed — routine when Playwright closes a page mid-response.
     * The whole process exits, so every scenario after that point fails for want
     * of a server rather than for anything it asserts. Observed twice on the same
     * commit in CI, crashing at test 13 in one run and 130 in the next, after
     * passing on two earlier runs of the same suite: a race, not a scenario.
     * `node` here is the third entry in the same list as Stryker and the
     * Playwright run itself — see AGENTS.md § Runtime.
     */
    command: `bun run build && node ./node_modules/vite/bin/vite.js preview --port ${String(ACCEPTANCE_PORT)} --strictPort`,
    /**
     * Never reused. A preview server left running from an earlier run serves an
     * earlier build, and a suite that passes against yesterday's bundle is worse
     * than a slow one.
     */
    reuseExistingServer: false,
    stdout: 'ignore',
    /** A cold build and a cold container both fit inside three minutes. */
    timeout: 180_000,
    url: ACCEPTANCE_ORIGIN,
  },
  /**
   * Two workers in CI, where the runner has two cores. Locally, Playwright's
   * default — one per two cores.
   *
   * The static server raised the ceiling rather than removing it: measured on
   * this machine, all three engines took 358s against the dev server at two
   * workers and 128s against the build at eight, but at eight the WebKit
   * keyboard walk failed once. So the default stands, and the number that had to
   * be forced down is no longer forced.
   */
  ...(isCi ? { workers: 2 } : {}),
})
