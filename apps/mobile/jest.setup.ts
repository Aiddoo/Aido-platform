// Expo 57 installs `fetch` as an enumerable lazy getter. Jest 29 enumerates globals
// after disposing the test environment, which can evaluate that getter too late and
// fail while loading ExpoModulesCoreJSLogger. Restore the original Node fetch eagerly
// for tests; individual HTTP tests can still replace it with their own mock.
const originalFetch =
  Object.getOwnPropertyDescriptor(globalThis, 'originalfetch')?.value ??
  Object.getOwnPropertyDescriptor(globalThis, 'originalFetch')?.value;

if (typeof originalFetch === 'function') {
  globalThis.fetch = originalFetch as typeof fetch;
}

/**
 * 네이티브 경계 대체 — 여기 한 곳에서만 한다.
 *
 * 아래 모듈들은 import 시점에 네이티브를 붙잡아 jest에서 그대로 터진다.
 * 손으로 가짜를 만들지 않고 각 패키지가 공식으로 내주는 mock을 쓴다.
 *
 * moduleNameMapper가 아니라 jest.mock인 이유: 공식 mock 일부가 내부에서
 * `jest.requireActual`로 실물을 다시 읽는데(safe-area-context), mapper는 그 호출까지
 * 가로채 실물에 닿지 못하게 만든다. jest.mock은 requireActual을 건드리지 않는다.
 *
 * reanimated는 목록에 없다 — 자체적으로 jest를 인식해 JS 경로로 도는 설계이고,
 * 터지던 이유는 worklets 하나였다. 공식 mock으로 갈아끼우면 useReducedMotion처럼
 * heroui-native가 쓰는 API가 빠져 오히려 렌더가 깨진다.
 */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// 이 mock은 CommonJS라 __esModule 표시가 없다. 그대로 두면 default import가
// 모듈 객체 전체로 잡혀 "Element type is invalid: got object"로 죽는다.
jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  ...require('@gorhom/bottom-sheet/mock'),
}));
jest.mock('expo-speech-recognition', () =>
  require('./src/shared/__tests__/mocks/expo-speech-recognition'),
);
jest.mock('react-native-keyboard-controller', () =>
  require('./src/shared/__tests__/mocks/react-native-keyboard-controller'),
);
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
require('react-native-gesture-handler/jestSetup');
