export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Keep bodies readable in `git log` on an 80-100 column terminal.
    'body-max-line-length': [2, 'always', 100],
    'header-max-length': [2, 'always', 72],
    'scope-case': [2, 'always', 'kebab-case'],
  },
}
