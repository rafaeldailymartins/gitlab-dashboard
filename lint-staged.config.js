export default {
  // Formatting first, then lint --fix. The test suites are not here: they are
  // the pipeline's job, and booting Vitest for the files one commit touches
  // cost minutes for a subset of what CI runs on every push anyway.
  //
  // `--no-warn-ignored` keeps generated files (the route tree) from tripping
  // `--max-warnings 0` just because ESLint was asked to ignore them. The cache
  // is the same one `bun run lint` fills, so whichever runs first pays for both.
  '*': 'prettier --write --ignore-unknown',
  '*.{ts,tsx}':
    'eslint --fix --max-warnings 0 --no-warn-ignored --cache --cache-location node_modules/.cache/eslint/',
}
