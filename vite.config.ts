import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

import { apiDevEndpoints } from './config/vite/api-dev'
import { environmentFor } from './netlify/lib/deploy-environment.mjs'

/**
 * What fault reporting is built with, as literals on every build.
 *
 * Empty when unset, never missing, so a build with no project compiles the
 * reporting chunk out rather than shipping it switched off (OBS-7) — see
 * `src/app/lib/monitoring.ts`. `CONTEXT` and `COMMIT_REF` are Netlify's, set
 * during its build and nowhere else; a local build names no release.
 */
function reportingDefines(env: Record<string, string | undefined>): Record<string, string> {
  return {
    'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(env['VITE_SENTRY_DSN']?.trim() ?? ''),
    'import.meta.env.VITE_SENTRY_ENVIRONMENT': JSON.stringify(environmentFor(env['CONTEXT'])),
    'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(env['COMMIT_REF'] ?? ''),
  }
}

/**
 * Where the plugin writes the compiled messages, which is not the same place
 * for a build. `vite build` compiles `message-modules`, which the bundle needs
 * to drop every message a chunk does not use; `bun run dev` and every gate read
 * `locale-modules` from `src/paraglide/`. Sharing the folder made each one
 * rebuild it after the other: a dev server after `bun run build` — or after
 * `bun run test:e2e`, which builds — was ready in 18.6s instead of 3.5s,
 * recompiling 391 files back. The build reaches its copy through the alias
 * below, ahead of `@`, so nothing in `src/` names where it is.
 */
const MESSAGES = {
  build: './node_modules/.cache/paraglide/build',
  serve: './src/paraglide',
} as const

export default defineConfig(({ command, mode }) => ({
  build: {
    // Written, uploaded by `scripts/upload-source-maps.ts` when there is
    // somewhere to upload them, then deleted by `scripts/drop-source-maps.ts`:
    // never referenced by a chunk and never served (OBS-8).
    sourcemap: 'hidden',
    target: 'es2023',
  },
  define: reportingDefines(loadEnv(mode, process.cwd(), '')),
  plugins: [
    // Must run before the React plugin so generated routes are transformed.
    tanstackRouter({
      autoCodeSplitting: true,
      generatedRouteTree: './src/app/routeTree.gen.ts',
      // Route files are app-layer wiring, so they live inside the app slice
      // rather than in a top-level folder FSD does not recognise.
      routesDirectory: './src/app/routes',
      // The default header adds '@ts-nocheck', which turns the exported
      // route tree into `any` and poisons every downstream type.
      routeTreeFileHeader: ['/* eslint-disable */'],
      target: 'react',
    }),
    react(),
    tailwindcss(),
    paraglideVitePlugin({
      emitTsDeclarations: true,
      isServer: 'false',
      outdir: MESSAGES[command],
      project: './project.inlang',
      strategy: ['localStorage', 'preferredLanguage', 'baseLocale'],
    }),
    // Serves both document functions during `bun run dev`. The production ones
    // are Netlify's; this is the same handler behind a middleware, so neither
    // the Netlify CLI nor its Vite plugin is a dependency of this repository.
    apiDevEndpoints(),
    // No `@sentry/vite-plugin`, deliberately. It injects a debug-ID snippet
    // into every chunk, and measured on this bundle that was 3.26 kB of gzip
    // on the initial load against 1.8 kB of headroom. The maps are uploaded
    // by `scripts/upload-source-maps.ts` instead, matched by release and file
    // name, which costs the bundle nothing.
  ],
  resolve: {
    // An array, not an object: the first entry that matches wins, `@` matches
    // `@/paraglide` too, and an object's keys are sorted by the linter.
    alias: [
      {
        find: '@/paraglide',
        replacement: fileURLToPath(new URL(MESSAGES[command], import.meta.url)),
      },
      { find: '@', replacement: fileURLToPath(new URL('src', import.meta.url)) },
    ],
  },
  server: {
    port: 3000,
    strictPort: true,
  },
}))
