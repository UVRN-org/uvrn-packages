/**
 * Shared ESLint configuration for all UVRN packages.
 * Individual packages extend this via { root: true } + their own overrides.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }]
  },
  env: {
    node: true,
    es2022: true
  },
  ignorePatterns: ['dist', 'node_modules', '**/*.d.ts', '**/*.js', '!.eslintrc.js', '**/*.test.ts', '**/*.spec.ts']
};
