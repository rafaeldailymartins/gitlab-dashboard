import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const alias = { '@': fileURLToPath(new URL('src', import.meta.url)) }

export default defineConfig({
  test: {
    coverage: {
      // Only code we author and that carries logic. Wiring (`app/`, `routes/`),
      // vendored shadcn components and generated output are covered by the
      // Playwright acceptance suite instead; see docs/qa/quality-metrics.md.
      exclude: ['**/*.test.{ts,tsx}', 'src/shared/i18n/**'],
      include: [
        'src/entities/**/*.{ts,tsx}',
        'src/features/**/*.{ts,tsx}',
        'src/widgets/**/*.{ts,tsx}',
        'src/pages/**/*.{ts,tsx}',
        'src/shared/lib/**/*.ts',
      ],
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        // The model layer is pure and cheap to test, so it carries no excuses.
        'src/**/model/**': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        statements: 90,
      },
    },

    projects: [
      {
        // Pure business rules: no DOM, no network, no React.
        resolve: { alias },
        test: {
          environment: 'node',
          include: ['src/**/model/**/*.test.ts', 'tests/domain/**/*.test.ts'],
          name: 'domain',
        },
      },
      {
        // Components and hooks against a DOM, with GitLab's API mocked by MSW.
        plugins: [react()],
        resolve: { alias },
        test: {
          environment: 'happy-dom',
          exclude: ['src/**/model/**'],
          include: ['src/**/*.test.tsx', 'src/**/*.test.ts', 'tests/ui/**/*.test.tsx'],
          name: 'ui',
          setupFiles: ['./tests/setup/ui.ts'],
        },
      },
    ],
  },
})
