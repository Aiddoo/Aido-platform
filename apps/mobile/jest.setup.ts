// Expo installs `fetch` as an enumerable lazy getter. Jest 29 enumerates globals
// after disposing the test environment, which can evaluate that getter too late and
// fail while loading ExpoModulesCoreJSLogger. Restore the original Node fetch eagerly
// for tests; individual HTTP tests can still replace it with their own mock.
const originalFetch =
  Object.getOwnPropertyDescriptor(globalThis, 'originalfetch')?.value ??
  Object.getOwnPropertyDescriptor(globalThis, 'originalFetch')?.value;

if (typeof originalFetch === 'function') {
  globalThis.fetch = originalFetch as typeof fetch;
}

// Reanimated 4.7 requires its web resolver for CSS initialization in Jest.
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

// Expo's window alias is not a DOM environment; initialize the official web test runtime without it.
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
Object.defineProperty(globalThis, 'window', { configurable: true, value: undefined });
require('react-native-reanimated').setUpTests();
if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);

jest.mock('react-native-svg', () => {
  const mockSvg = require('react-native-reanimated/src/mock-svg');
  return { ...mockSvg, default: mockSvg.Svg };
});
