import { defineConfig, devices } from '@playwright/test'
import { defineBddConfig } from 'playwright-bdd'

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

export default defineConfig({
  forbidOnly: isCi,
  fullyParallel: true,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  reporter: isCi ? [['html', { open: 'never' }], ['list']] : [['list']],
  retries: isCi ? 1 : 0,
  testDir,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'bun run dev',
    reuseExistingServer: !isCi,
    stdout: 'ignore',
    /**
     * A cold container transforms the whole module graph on the first request,
     * which takes longer than Playwright's default minute. Locally the default
     * is plenty and a slow start is worth noticing.
     */
    ...(isCi ? { timeout: 180_000 } : {}),
    url: 'http://localhost:3000',
  },
  /**
   * Two workers everywhere, CI or not. The bottleneck is not the CPU: every
   * browser talks to one Vite dev server, and Playwright's default of a worker
   * per two cores puts more concurrent page loads on it than it can transform
   * inside a five-second expectation. The measurement is recorded once, in
   * `docs/qa/quality-metrics.md`; the short version is that the default failed
   * 25 scenarios, every one of them WebKit, and two workers ran the whole suite
   * green in half the wall-clock time. A suite that fails for its own reasons is
   * worse than a slow one.
   */
  workers: 2,
})
