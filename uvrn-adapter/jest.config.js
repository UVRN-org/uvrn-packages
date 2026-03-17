/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts'],
  moduleNameMapper: {
    '^@uvrn/core$': '<rootDir>/../uvrn-core/src'
  },
  // Transform ESM-only @noble packages so Jest (CJS) can load them (pnpm paths include .pnpm/@noble+...)
  transformIgnorePatterns: ['/node_modules/(?!.*@noble)'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '.*@noble.*\\.js$': 'babel-jest'
  }
};

