module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.ts', // re-exports only
    '!src/umd.ts' // UMD bundle entry — exercised by the esbuild build, not unit tests
  ],
  // Gate applies only when coverage is collected (test:coverage); plain jest runs stay fast.
  coverageThreshold: {
    global: {
      lines: 60
    }
  }
};
