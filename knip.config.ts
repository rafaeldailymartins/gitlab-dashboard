import type { KnipConfig } from 'knip'

/**
 * Dead-code gate. Anything unreachable from an entry point — an unused export,
 * file, dependency or type — is an error rather than something that quietly
 * accumulates. Knip auto-detects the tooling config files, so only the
 * application entry points are listed here.
 */
export default {
  entry: ['src/app/routes/**/*.tsx', 'steiger.config.ts', 'tests/**/*.ts'],
  ignore: ['src/app/routeTree.gen.ts'],
  ignoreDependencies: [
    // Pulled in by `@import` inside styles.css, which knip does not follow.
    'tailwindcss',
    'tw-animate-css',
    // Command-line tools, invoked from npm scripts rather than imported.
    '@fission-ai/openspec',
  ],
  project: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'],
} satisfies KnipConfig
