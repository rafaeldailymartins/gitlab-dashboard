import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

/**
 * Feature-Sliced Design linter. Complements `boundaries/dependencies` in the
 * ESLint config: boundaries enforces the direction of imports between layers,
 * steiger enforces FSD's own conventions (public API per slice, no cross-slice
 * imports, no layer skipping).
 */
export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Generated output is neither authored here nor FSD-shaped.
    ignores: ['**/paraglide/**', '**/routeTree.gen.ts'],
  },
])
