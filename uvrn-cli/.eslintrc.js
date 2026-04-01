module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  ignorePatterns: ['dist', 'node_modules', '*.js'],
  rules: {
    '@typescript-eslint/no-var-requires': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn'
  }
};
