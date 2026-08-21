/** Build output, reports and generated code: nothing here is authored by hand. */
export const IGNORED_PATHS = [
  'dist/**',
  'coverage/**',
  'playwright-report/**',
  'test-results/**',
  'blob-report/**',
  '.features-gen/**',
  'reports/**',
  '.stryker-tmp/**',
  '.type-coverage/**',
  'src/paraglide/**',
  'src/app/routeTree.gen.ts',
]

/** Tooling configs whose plugins ship no type declarations. */
export const UNTYPED_TOOLING_FILES = ['eslint.config.js', 'steiger.config.ts']

export const TEST_FILES = [
  '**/*.test.ts',
  '**/*.test.tsx',
  'tests/setup/**/*.ts',
  'tests/ui/**/*.tsx',
]

/** Gherkin step definitions, run by vitest-cucumber. */
export const GHERKIN_STEP_FILES = ['tests/domain/**/*.test.ts']

export const E2E_FILES = ['tests/e2e/**/*.ts']

/** Playwright-bdd step definitions: `Then(...)` is not a static test block. */
export const E2E_STEP_RULES = { 'playwright/no-standalone-expect': 'off' }

/** Components written by the shadcn CLI rather than by us. */
export const VENDORED_UI_FILES = ['src/shared/ui/**']
