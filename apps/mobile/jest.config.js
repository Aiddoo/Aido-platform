/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  clearMocks: true,
  restoreMocks: true,
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm/[^/]+/node_modules/)?(react-native|@react-native|expo|@expo|heroui-native|uniwind|tailwind-variants|tailwind-merge|@gorhom|react-native-reanimated|react-native-gesture-handler|react-native-svg|react-native-worklets|ky|standard-navigation))',
  ],
  moduleNameMapper: {
    // Path aliases
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/app/$1',
    '^@assets/(.*)$': '<rootDir>/assets/$1',

    // Monorepo packages
    '^@aido/validators$': '<rootDir>/../../packages/validators/src',
    '^@aido/errors$': '<rootDir>/../../packages/errors/src',
    '^@aido/utils$': '<rootDir>/../../packages/utils/src',

    // Native module mocks
    '^expo-secure-store$': '<rootDir>/src/shared/__tests__/mocks/expo-secure-store.ts',
    '^expo-localization$': '<rootDir>/src/shared/__tests__/mocks/expo-localization.ts',
    // v4(Nitro)는 import 시 NitroModules를 eager 로드해 jest에서 크래시 — 인메모리 목으로 대체
    '^react-native-mmkv$': '<rootDir>/src/shared/__tests__/mocks/react-native-mmkv.ts',
  },
  testMatch: ['**/__tests__/**/*.(test|spec).[jt]s?(x)', '**/*.(test|spec).[jt]s?(x)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__tests__/**',
    '!**/node_modules/**',
  ],
  watchman: false,
};
