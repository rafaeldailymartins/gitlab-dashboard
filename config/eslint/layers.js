/**
 * Feature-Sliced Design layers. `boundaries/dependencies` turns the "a layer may
 * only import from the layers below it" rule into a lint error instead of a
 * convention nobody enforces.
 *
 * `partialMatch: false` means the pattern must match the whole path (the v7
 * replacement for the old `mode: 'full'`); omitting it matches folder prefixes.
 */
export const FSD_ELEMENTS = [
  { capture: ['slice'], pattern: 'src/shared/*', type: 'shared' },
  { capture: ['slice'], pattern: 'src/entities/*', type: 'entities' },
  { capture: ['slice'], pattern: 'src/features/*', type: 'features' },
  { capture: ['slice'], pattern: 'src/widgets/*', type: 'widgets' },
  { capture: ['slice'], pattern: 'src/pages/*', type: 'pages' },
  { partialMatch: false, pattern: 'src/app/**', type: 'app' },
  { partialMatch: false, pattern: 'src/paraglide/**', type: 'generated' },
]

/** Which layers each layer may reach. Lowest layer first. */
const FSD_ALLOWED = {
  app: ['shared', 'generated', 'entities', 'features', 'widgets', 'pages'],
  entities: ['shared', 'generated', 'entities'],
  features: ['shared', 'generated', 'entities'],
  generated: ['generated'],
  pages: ['shared', 'generated', 'entities', 'features', 'widgets'],
  shared: ['shared', 'generated'],
  widgets: ['shared', 'generated', 'entities', 'features'],
}

export const FSD_POLICIES = Object.entries(FSD_ALLOWED).map(([from, allowed]) => ({
  allow: { to: { element: { types: { anyOf: allowed } } } },
  from: { element: { type: from } },
}))

/**
 * The app is a static browser bundle. `node` types are in the TypeScript
 * program for the build tooling, so this keeps them out of shipped code.
 */
const NO_NODE_BUILTINS = {
  group: ['node:*'],
  message: 'This app runs only in the browser; Node built-ins are unavailable.',
}

export const BROWSER_ONLY_RULES = {
  'no-restricted-imports': ['error', { patterns: [NO_NODE_BUILTINS] }],
}

/**
 * Keeps the pure business rules pure: no React, no framework, no I/O, no
 * localisation. This is what makes the domain testable without any test double.
 */
export const DOMAIN_PURITY_RULES = {
  'no-restricted-globals': [
    'error',
    { message: 'Model code must be pure. Inject data as parameters.', name: 'fetch' },
    { message: 'Model code must be pure. Use a port.', name: 'localStorage' },
    { message: 'Model code must be pure. Use a port.', name: 'sessionStorage' },
    { message: 'Model code must be pure.', name: 'window' },
    { message: 'Model code must be pure.', name: 'document' },
  ],
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        NO_NODE_BUILTINS,
        { group: ['react', 'react-dom', 'react/*'], message: 'Model must not use React.' },
        { group: ['@tanstack/*'], message: 'Model must not use framework libraries.' },
        { group: ['**/api/**', '@/shared/api*'], message: 'Model must not reach for adapters.' },
        { group: ['@/shared/i18n*', '@/paraglide/*'], message: 'Model must not localise.' },
      ],
    },
  ],
}
