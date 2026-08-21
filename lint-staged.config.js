export default {
  // Formatting first, then lint --fix, then the tests that cover what changed.
  // `--no-warn-ignored` keeps generated files (the route tree) from tripping
  // `--max-warnings 0` just because ESLint was asked to ignore them.
  '*': 'prettier --write --ignore-unknown',
  '*.{ts,tsx}': [
    'eslint --fix --max-warnings 0 --no-warn-ignored',
    // `--silent` must carry an explicit value, or vitest's CLI parses the first
    // staged file path as the flag's argument.
    'vitest related --run --passWithNoTests --silent=true',
  ],
}
