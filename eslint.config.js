import js from '@eslint/js'
import vitest from '@vitest/eslint-plugin'
import boundaries from 'eslint-plugin-boundaries'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import perfectionist from 'eslint-plugin-perfectionist'
import playwright from 'eslint-plugin-playwright'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import sonarjs from 'eslint-plugin-sonarjs'
import testingLibrary from 'eslint-plugin-testing-library'
import unicorn from 'eslint-plugin-unicorn'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

import {
  BROWSER_ONLY_RULES,
  DOMAIN_PURITY_RULES,
  FSD_ELEMENTS,
  FSD_POLICIES,
} from './config/eslint/layers.js'
import {
  COMPLEXITY_RULES,
  COMPONENT_LENGTH_RULE,
  UNUSED_ARGUMENT_RULE,
} from './config/eslint/limits.js'
import {
  E2E_FILES,
  E2E_STEP_RULES,
  GHERKIN_STEP_FILES,
  IGNORED_PATHS,
  TEST_FILES,
  UNTYPED_TOOLING_FILES,
  VENDORED_UI_FILES,
} from './config/eslint/paths.js'

/** Vendored files are not authored here, so their ordering is not ours. */
const PERFECTIONIST_OFF = Object.fromEntries(
  Object.keys(perfectionist.rules).map((rule) => [`perfectionist/${rule}`, 'off']),
)

export default defineConfig(
  globalIgnores(IGNORED_PATHS),

  // --------------------------------------------------------------- base rules
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  sonarjs.configs.recommended,
  unicorn.configs.recommended,
  perfectionist.configs['recommended-natural'],

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { boundaries },
    rules: {
      ...COMPLEXITY_RULES,
      ...UNUSED_ARGUMENT_RULE,

      'boundaries/dependencies': ['error', { default: 'disallow', policies: FSD_POLICIES }],

      // Correctness and intent.
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
      'no-param-reassign': ['error', { props: true }],

      // Named exports only: they keep imports greppable and refactors safe.
      'no-restricted-exports': ['error', { restrictDefaultExports: { direct: true } }],
      'prefer-const': 'error',

      // `unicorn` opinions that fight this codebase rather than improve it:
      // GraphQL responses legitimately use null, and expanding `props`/`ref`
      // into `properties`/`reference` makes React code harder to read.
      'unicorn/no-null': 'off',
      'unicorn/prevent-abbreviations': 'off',
    },
    settings: { 'boundaries/elements': FSD_ELEMENTS },
  },

  // -------------------------------------------------------------------- React
  { files: ['**/*.tsx'], ...react.configs.flat.recommended },
  { files: ['**/*.tsx'], ...react.configs.flat['jsx-runtime'] },
  { files: ['**/*.tsx'], ...jsxA11y.flatConfigs.strict },
  {
    files: ['**/*.tsx'],
    rules: {
      /**
       * A scrollable region has to take focus, or a keyboard reader cannot
       * scroll it — axe's `scrollable-region-focusable` is WCAG 2.1.1 and the
       * acceptance suite runs it. This rule reads the markup and cannot know
       * the element scrolls, so the two disagree; the one measuring the
       * rendered page wins. Only `region` is added, and only because that is
       * the role a scroll container carries here.
       */
      'jsx-a11y/no-noninteractive-tabindex': [
        'error',
        { allowExpressionValues: true, roles: ['region', 'tabpanel'], tags: [] },
      ],
    },
  },
  { files: ['**/*.tsx'], ...reactHooks.configs.flat['recommended-latest'] },
  {
    files: ['**/*.tsx'],
    languageOptions: { globals: globals.browser },
    rules: {
      ...COMPONENT_LENGTH_RULE,
      'react/jsx-no-leaked-render': ['error', { validStrategies: ['ternary'] }],
      'react/no-unstable-nested-components': 'error',
      'react/self-closing-comp': 'error',
    },
    settings: { react: { version: 'detect' } },
  },

  // ------------------------------------------------- shipped code is browser-only
  { files: ['src/**/*.{ts,tsx}'], rules: BROWSER_ONLY_RULES },

  // ------------------------- model purity: FSD's `model` segment is the domain
  { files: ['src/**/model/**/*.ts'], rules: DOMAIN_PURITY_RULES },

  // --------------------------------------------- vendored shadcn/ui components
  {
    files: VENDORED_UI_FILES,
    rules: {
      ...PERFECTIONIST_OFF,
      // A generic <Label> wrapper receives `htmlFor` from its caller, so the
      // association it needs is not visible in this file. `SelectField` and
      // every other authored component still has to satisfy the rule.
      'jsx-a11y/label-has-associated-control': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'sonarjs/no-nested-conditional': 'off',
      'sonarjs/prefer-read-only-props': 'off',
    },
  },

  // -------------------------------------------------------------------- tests
  { files: TEST_FILES, ...testingLibrary.configs['flat/react'] },
  {
    files: TEST_FILES,
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'max-statements': 'off',
      // Asserting a rounding contract requires exact equality: the point of
      // `secondsToHours(1800) === 0.5` is that the result is not approximate.
      'sonarjs/no-floating-point-equality': 'off',
      'vitest/consistent-test-it': ['error', { fn: 'it' }],
      'vitest/no-disabled-tests': 'error',
      'vitest/no-focused-tests': 'error',
    },
    settings: { vitest: { typecheck: true } },
  },
  {
    // `describeFeature` builds the describe/it blocks at runtime, so the linter
    // cannot see the test structure statically.
    files: GHERKIN_STEP_FILES,
    rules: {
      'sonarjs/no-empty-test-file': 'off',
      'vitest/expect-expect': 'off',
      'vitest/no-standalone-expect': 'off',
    },
  },
  {
    files: ['tests/setup/**/*.ts'],
    rules: {
      // Vitest runs without global injection, so Testing Library cannot find a
      // global `afterEach` and its automatic cleanup never registers.
      'testing-library/no-manual-cleanup': 'off',
    },
  },
  { files: E2E_FILES, ...playwright.configs['flat/recommended'] },
  { files: E2E_FILES, rules: E2E_STEP_RULES },

  // --------------------------------------------------------- tooling and specs
  {
    files: [
      '*.config.ts',
      '*.config.js',
      'config/**/*.js',
      'tests/**/*.{ts,tsx}',
      // Tests reach across layers on purpose: a component test renders the
      // providers the app mounts, whatever layer they live in.
      ...TEST_FILES,
    ],
    rules: {
      'boundaries/dependencies': 'off',
      'no-restricted-exports': 'off',
    },
  },
  {
    /**
     * The serverless function.
     *
     * It runs on Node, which is why it lives outside `src/` — and why the
     * browser-only rule above does not reach it. That rule is applied by a
     * `src/**` glob rather than by an exclusion here; widening the glob to
     * `**\/*.ts` would forbid `node:*` in the one place it belongs.
     *
     * FSD does not describe this directory, so the layer rule has nothing to
     * say about it. The default export is the platform's calling convention
     * rather than a style choice.
     */
    files: ['netlify/**/*.mts'],
    languageOptions: { globals: globals.node },
    rules: {
      'boundaries/dependencies': 'off',
      'no-restricted-exports': 'off',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' },
  },
  {
    files: UNTYPED_TOOLING_FILES,
    rules: {
      // Several ESLint plugins and the steiger FSD plugin ship no type
      // declarations, so type-aware rules see `any` here. Nothing in these
      // files reaches production, and `bun run typecheck` still covers them.
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['.size-limit.js'],
    rules: {
      // size-limit loads this file as a module and reads its default export.
      // Named exports are the rule everywhere a human imports from; a tool's
      // config format is not ours to choose.
      'no-restricted-exports': 'off',
    },
  },
)
