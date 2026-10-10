module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts', // Index files are just re-exports
    '!src/types/**', // Type-only files
    '!src/errors/**', // Simple error classes, fully tested
    '!src/client.ts' // Client requires integration tests with mocks
  ],
  coverageThreshold: {
    global: {
      branches: 82,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  moduleNameMapper: {
    '^@uvrn/core$': '<rootDir>/../uvrn-core/src'
  }
};
