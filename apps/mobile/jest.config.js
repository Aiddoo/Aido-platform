/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm/[^/]+/node_modules/)?(react-native|@react-native|expo|@expo|heroui-native|uniwind|tailwind-variants|tailwind-merge|@gorhom|react-native-reanimated|react-native-gesture-handler|react-native-svg|react-native-worklets))',
  ],
  moduleNameMapper: {
    '^@aido/api-types$': '<rootDir>/../../packages/api-types/src',
    '^@aido/utils$': '<rootDir>/../../packages/utils/src',
  },
  testMatch: ['**/__tests__/**/*.(test|spec).[jt]s?(x)', '**/*.(test|spec).[jt]s?(x)'],
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/coverage/**',
    '!**/node_modules/**',
    '!**/babel.config.js',
    '!**/jest.config.js',
  ],
};
