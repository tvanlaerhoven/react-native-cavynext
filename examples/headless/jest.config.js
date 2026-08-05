/** Jest configuration for the headless example app. */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/__tests__/**/*.test.tsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  // Run against the library's source, so the example can never pass against a
  // stale build of packages/core.
  moduleNameMapper: {
    '^react-native-cavynext$': '<rootDir>/../../packages/core/src/index.ts',
  },
};
