const { resolveTestWorkers } = require('@aido/vitest-config/test-workers');

/**
 * process.env.EXPO_OS는 babel-preset-expo가 transform 때 플랫폼 상수로 바꾼다.
 * 기본은 iOS이고, Android에서만 달라지는 로직은 `*.android.test.ts(x)`를 jest-expo/android로 돌린다.
 */
/** @type {import('jest').Config} */
const base = {
  resolver: '<rootDir>/jest.resolver.cjs',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  clearMocks: true,
  restoreMocks: true,
  // d3-shape·d3-path는 ESM 전용(.mjs)으로 배포된다. preset의 [jt]sx? 변환에 .mjs만 더한다
  transform: { '^.+\\.mjs$': 'babel-jest' },
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm/[^/]+/node_modules/)?(react-native|@react-native|expo|@expo|heroui-native|uniwind|tailwind-variants|tailwind-merge|@gorhom|react-native-reanimated|react-native-gesture-handler|react-native-svg|react-native-worklets|ky|standard-navigation|@revenuecat|@shopify/flash-list|d3-shape|d3-path))',
  ],
  moduleNameMapper: {
    // packages/api 소스가 `./x/index.js`로 import해 TS 원본으로 풀어야 한다
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // .svg는 별칭보다 먼저 잡아야 한다 — @assets/... 규칙이 먼저 걸리면 에셋으로 새어 나간다
    '\\.svg$': '<rootDir>/src/testing/mocks/svg.tsx',

    '^@shopify/react-native-skia$': '<rootDir>/src/testing/mocks/react-native-skia.tsx',

    // Path aliases
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@assets/(.*)$': '<rootDir>/assets/$1',

    // Monorepo packages
    '^@aido/api(?:/(.*))?$': '<rootDir>/../../packages/api/src/$1',

    // Native module mocks
    '^expo-secure-store$': '<rootDir>/src/testing/mocks/expo-secure-store.ts',
    '^expo-localization$': '<rootDir>/src/testing/mocks/expo-localization.ts',
    '^expo-audio$': '<rootDir>/src/testing/mocks/expo-audio.ts',
    // v4(Nitro)는 import 시 NitroModules를 eager 로드해 jest에서 크래시 — 인메모리 목으로 대체
    '^react-native-mmkv$': '<rootDir>/src/testing/mocks/react-native-mmkv.ts',
    // 위젯 트리는 네이티브 렌더러가 그린다. 테스트는 요소 이름과 props로 트리를 읽는다
    '^react-native-android-widget$': '<rootDir>/src/testing/mocks/react-native-android-widget.ts',
    '^@expo/ui/swift-ui$': '<rootDir>/src/testing/mocks/expo-ui-swift-ui.ts',
    '^@expo/ui/swift-ui/modifiers$': '<rootDir>/src/testing/mocks/expo-ui-swift-ui-modifiers.ts',
    // SDK가 ESM이라 jest가 읽지 못한다. 보고는 목 호출로 확인한다
    '^@sentry/react-native$': '<rootDir>/src/testing/mocks/sentry-react-native.ts',
    '^expo-widgets$': '<rootDir>/src/testing/mocks/expo-widgets.ts',
  },
};

/** @type {import('jest').Config} */
module.exports = {
  // testTimeout은 전역 옵션이라 projects 안에 두면 무시되고 기본 5초로 돈다. 첫 렌더가 불러오는 모듈을
  // 변환하는 시간이 변환 캐시가 비었거나 CI·부하가 큰 곳에서 5초를 넘긴다
  testTimeout: 15_000,
  // 워크트리마다 감시자를 띄우지 않고 파일 목록만 읽는다
  watchman: false,
  // 폐기된 Jest API를 쓰면 조용히 넘어가지 않고 실패한다
  errorOnDeprecated: true,
  // 기본 위치(OS 임시 폴더)는 워크트리끼리 변환 캐시가 섞이고 청소되기도 한다
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  // worker별 힙 사용량을 CI 로그에 남겨 workerIdleMemoryLimit 조정 근거로 쓴다
  logHeapUsage: process.env.CI === 'true',
  // 기본값(코어 수 - 1)은 다른 작업과 함께 돌 때 기기를 포화시킨다. CI는 --maxWorkers로 덮어쓴다
  maxWorkers: resolveTestWorkers(process.env, '50%'),
  // worker가 파일을 돌수록 1.4GB 넘게 자라 실행 전체 RSS가 16GB에 이른다. 넘긴 worker를 새로 띄워 최대 메모리를 묶는다
  workerIdleMemoryLimit: '1GB',
  // 매 실행이 순서 의존을 검사한다. 실패하면 출력된 seed로 `pnpm test --seed <seed>` 재현
  randomize: true,
  showSeed: true,
  projects: [
    {
      ...base,
      displayName: 'ios',
      preset: 'jest-expo/ios',
      testMatch: ['**/*.test.[jt]s?(x)'],
      testPathIgnorePatterns: ['/node_modules/', '\\.android\\.test\\.'],
    },
    {
      ...base,
      displayName: 'android',
      preset: 'jest-expo/android',
      testMatch: ['**/*.android.test.[jt]s?(x)'],
    },
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__tests__/**',
    '!**/node_modules/**',
  ],
};
