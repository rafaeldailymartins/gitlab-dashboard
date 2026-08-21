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
    url: 'http://localhost:3000',
  },
  // `exactOptionalPropertyTypes` forbids passing `undefined` explicitly, so the
  // local default (one worker per core) is expressed by omitting the key.
  ...(isCi ? { workers: 2 } : {}),
})
