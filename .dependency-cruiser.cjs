/**
 * Dependency graph rules. These complement the ESLint layer rules: ESLint
 * checks the direction of each import, dependency-cruiser checks properties of
 * the graph as a whole (cycles, orphans, unresolvable edges).
 */
module.exports = {
  forbidden: [
    {
      comment:
        'A dependency cycle makes both modules impossible to understand or test in isolation. Extract the shared part into its own module.',
      from: {},
      name: 'no-circular',
      severity: 'error',
      to: { circular: true },
    },
    {
      comment:
        'This module is imported by nothing and imports nothing. It is either dead code or a missing wire-up.',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)[.][^/]+[.](?:js|cjs|mjs|ts|cts|mts|json)$', // dotfiles
          '[.]d[.]ts$',
          '(^|/)tsconfig[.]json$',
          '(^|/)(?:babel|webpack)[.]config[.](?:js|cjs|mjs|ts|json)$',
          '^src/app/routeTree[.]gen[.]ts$',
          '^src/paraglide/',
        ],
      },
      name: 'no-orphans',
      severity: 'error',
      to: {},
    },
    {
      comment: 'This import could not be resolved. It will fail at runtime.',
      from: {},
      name: 'not-to-unresolvable',
      severity: 'error',
      to: { couldNotResolve: true },
    },
    {
      comment:
        'Application code must not import a devDependency; it would be missing from a production install.',
      from: { path: '^src/', pathNot: ['[.]test[.]tsx?$'] },
      name: 'not-to-dev-dep',
      severity: 'error',
      to: { dependencyTypes: ['npm-dev'], pathNot: ['^src/'] },
    },
    {
      comment: 'Depending on a deprecated npm package is a maintenance trap.',
      from: {},
      name: 'no-deprecated-npm',
      severity: 'error',
      to: { dependencyTypes: ['deprecated'] },
    },
  ],

  options: {
    doNotFollow: { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-bundled'] },
    exclude: { path: ['^src/paraglide/', '[.]test[.]tsx?$'] },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
}
