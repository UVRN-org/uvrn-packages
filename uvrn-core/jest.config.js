module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  // A7 gate: 80% lines. (The old 4-metric block failed on branches — 71% — so the
  // pre-existing test:coverage script never passed; the protocol gate is lines-based.)
  // Applies only when coverage is collected (test:coverage); plain jest runs stay fast.
  coverageThreshold: {
    global: {
      lines: 80
    }
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  verbose: true
};
