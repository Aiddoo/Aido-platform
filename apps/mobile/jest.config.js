/**
 * process.env.EXPO_OS는 babel-preset-expo가 transform 때 플랫폼 상수로 바꾼다.
 * 기본은 iOS이고, Android에서만 달라지는 로직은 `*.android.test.ts(x)`를 jest-expo/android로 돌린다.
 */
const base = {
  resolver: '<rootDir>/jest.resolver.cjs',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  clearMocks: true,
  restoreMocks: true,
  // d3-shape·d3-path는 ESM 전용(.mjs)으로 배포된다. preset의 [jt]sx? 변환에 .mjs만 더한다
  transform: { '^.+\\.mjs$': 'babel-jest' },
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm/[^/]+/node_modules/)?(react-native|@react-native|expo|@expo|heroui-native|uniwind|tailwind-variants|tailwind-merge|@gorhom|react-native-reanimated|react-native-gesture-handler|react-native-svg|react-native-worklets|ky|standard-navigation|@revenuecat|@shopify\/flash-list|d3-shape|d3-path))',
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // .svg는 별칭보다 먼저 잡아야 한다 — @assets/... 규칙이 먼저 걸리면 에셋으로 새어 나간다
    '\\.svg$': '<rootDir>/src/shared/__tests__/mocks/svg.tsx',

    '^@shopify/react-native-skia$': '<rootDir>/src/shared/__tests__/mocks/react-native-skia.tsx',

    // Path aliases
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/app/$1',
    '^@assets/(.*)$': '<rootDir>/assets/$1',

    // Monorepo packages
    '^@aido/api/vocabulary$': '<rootDir>/../../packages/api/src/vocabulary',
    '^@aido/api$': '<rootDir>/../../packages/api/src',
    '^@aido/api/errors$': '<rootDir>/../../packages/api/src/errors',

    // Native module mocks
    '^expo-secure-store$': '<rootDir>/src/shared/__tests__/mocks/expo-secure-store.ts',
    '^expo-localization$': '<rootDir>/src/shared/__tests__/mocks/expo-localization.ts',
    '^expo-audio$': '<rootDir>/src/shared/__tests__/mocks/expo-audio.ts',
    // v4(Nitro)는 import 시 NitroModules를 eager 로드해 jest에서 크래시 — 인메모리 목으로 대체
    '^react-native-mmkv$': '<rootDir>/src/shared/__tests__/mocks/react-native-mmkv.ts',
    // 위젯 트리는 네이티브 렌더러가 그린다. 테스트는 요소 이름과 props로 트리를 읽는다
    '^react-native-android-widget$':
      '<rootDir>/src/shared/__tests__/mocks/react-native-android-widget.ts',
    '^@expo/ui/swift-ui$': '<rootDir>/src/shared/__tests__/mocks/expo-ui-swift-ui.ts',
    '^@expo/ui/swift-ui/modifiers$':
      '<rootDir>/src/shared/__tests__/mocks/expo-ui-swift-ui-modifiers.ts',
    '^expo-widgets$': '<rootDir>/src/shared/__tests__/mocks/expo-widgets.ts',
  },
  watchman: false,
};

module.exports = {
  projects: [
    {
      ...base,
      displayName: 'ios',
      preset: 'jest-expo/ios',
      testMatch: ['**/__tests__/**/*.(test|spec).[jt]s?(x)', '**/*.(test|spec).[jt]s?(x)'],
      testPathIgnorePatterns: ['/node_modules/', '\\.android\\.test\\.'],
    },
    {
      ...base,
      displayName: 'android',
      preset: 'jest-expo/android',
      testMatch: ['**/*.android.(test|spec).[jt]s?(x)'],
    },
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__tests__/**',
    '!**/node_modules/**',
  ],
};
