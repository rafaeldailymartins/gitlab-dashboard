/**
 * Ceilings that keep functions and files small enough to hold in your head.
 * Raising one of these numbers needs a reason recorded in the commit message,
 * not a silent edit.
 */
/** Parameters kept only to document a signature are prefixed with _. */
export const UNUSED_ARGUMENT_RULE = {
  '@typescript-eslint/no-unused-vars': [
    'error',
    { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
  ],
}

export const COMPLEXITY_RULES = {
  complexity: ['error', 8],
  'max-depth': ['error', 3],
  'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
  'max-nested-callbacks': ['error', 3],
  'max-params': ['error', 3],
  'max-statements': ['error', 15],
  'sonarjs/cognitive-complexity': ['error', 10],
}

/**
 * JSX is declarative, so a component can be longer than a plain function while
 * staying simple. `sonarjs/cognitive-complexity` still guards its logic.
 */
export const COMPONENT_LENGTH_RULE = {
  'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
}
