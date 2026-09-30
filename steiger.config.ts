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
  {
    /**
     * `shared-lib-grouping` counts files, and more than half of these are
     * their own tests.
     *
     * The rule's threshold is fifteen modules, on the argument that a bag of
     * that many loose utilities wants subfolders. `src/shared/lib` holds
     * **eight**: date, duration, format, people, single-flight, storage,
     * use-debounced and utils. The other nine files are the co-located
     * `*.test.ts` for each — two of them for date — which this repository requires and which say
     * nothing about whether the directory is organised.
     *
     * Turned off rather than worked around by moving a test elsewhere, which
     * would trade a real convention for a linter's arithmetic. Revisit this if
     * the module count itself — not the file count — passes fifteen.
     */
    files: ['./src/shared/lib/**'],
    rules: { 'fsd/shared-lib-grouping': 'off' },
  },
])
