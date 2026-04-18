const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/.next/standalone/'],
  testPathIgnorePatterns: ['<rootDir>/.claude/'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/*.test.ts',
    '**/*.test.tsx',
  ],
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
};

// next/jest sets transformIgnorePatterns to ignore all node_modules by default.
// We need to override it so that ESM-only packages from @upstash/* are transpiled.
const jestConfig = createJestConfig(customJestConfig);

module.exports = async () => {
  const config = await jestConfig();
  config.transformIgnorePatterns = [
    // Keep the existing next/jest pattern but carve out @upstash packages
    '/node_modules/(?!(@upstash|uncrypto)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ];
  return config;
};
