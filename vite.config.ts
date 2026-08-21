import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    sourcemap: true,
    target: 'es2023',
  },
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
      outdir: './src/paraglide',
      project: './project.inlang',
      strategy: ['localStorage', 'preferredLanguage', 'baseLocale'],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
})
