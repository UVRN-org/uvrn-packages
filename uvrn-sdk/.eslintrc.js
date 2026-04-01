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
  overrides: [
    { files: ['src/__tests__/**/*.ts'], rules: { '@typescript-eslint/no-explicit-any': 'off' } }
  ]
};
