// jest는 Node에서 돌아 앱의 Hermes에 없는 메서드도 그냥 통과한다. 앱에서 실측한 빈칸을 Node에서도 비운다.
// 같은 목록을 .oxlintrc.json의 no-restricted-properties가 소스에서도 막는다.
Reflect.deleteProperty(Array.prototype, 'toSorted');
Reflect.deleteProperty(Array, 'fromAsync');

// env.ts가 읽는 빌드 값. 테스트마다 env를 mock하지 않게 앱 시작과 같은 경로로 준다.
jest.mock('expo-constants', () => {
  const actual = jest.requireActual('expo-constants');
  return {
    ...actual,
    __esModule: true,
    default: Object.create(actual.default, {
      expoConfig: {
        configurable: true,
        value: {
          scheme: 'aido',
          version: '0.0.0-test',
          extra: {
            env: 'development',
            apiUrl: 'http://localhost:3000',
            isDevelopment: true,
            isProduction: false,
          },
        },
      },
    }),
  };
});
// Reanimated 4.7 requires its web resolver for CSS initialization in Jest.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// 네이티브 모듈이 없으면 randomUUID가 undefined를 준다. 멱등 키처럼 호출마다 달라야 하는 값을 테스트한다.
jest.mock('expo-crypto', () => {
  let count = 0;
  return {
    ...jest.requireActual('expo-crypto'),
    randomUUID: () => {
      count += 1;
      return `test-uuid-${count}`;
    },
  };
});
// 공식 mock은 CommonJS라 __esModule 표시가 없다. 그대로 두면 default import가
// 모듈 객체 전체로 잡혀 "Element type is invalid: got object"로 죽어 감싼 모듈을 쓴다.
jest.mock('@gorhom/bottom-sheet', () => require('./src/testing/mocks/gorhom-bottom-sheet'));
jest.mock('react-native-keyboard-controller', () =>
  require('./src/testing/mocks/react-native-keyboard-controller'),
);
jest.mock('react-native-reserved-regions', () =>
  require('./src/testing/mocks/react-native-reserved-regions'),
);
jest.mock('expo-router', () => require('./src/testing/mocks/expo-router'));
// 네이티브 이벤트 스트림을 읽는 훅이라 Jest에서는 값이 오지 않는다. 링크로 들어오는 흐름은 테스트가 값을 정한다.
jest.mock('expo-linking', () => ({
  ...jest.requireActual('expo-linking'),
  useLinkingURL: jest.fn(() => null),
}));
// 네이티브 스플래시가 없어 호출이 reject한다. 숨김 시점을 보는 테스트가 호출 기록을 읽는다.
jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(async () => {}),
  preventAutoHideAsync: jest.fn(async () => {}),
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
require('react-native-gesture-handler/jestSetup');
// Android 날짜·시간 피커는 import할 때 네이티브 모듈을 찾는다. `@src/shared/ui` 입구가 time-picker를 함께 읽어
// 그 입구를 쓰는 Android 테스트(renderScreen의 HeroUIProvider 포함)가 모듈 등록 없이 죽지 않게 빈 모듈을 둔다
if (process.env.EXPO_OS === 'android') {
  const { NativeModules } = require('react-native');
  for (const name of [
    'RNCDatePicker',
    'RNCTimePicker',
    'RNCMaterialDatePicker',
    'RNCMaterialTimePicker',
  ]) {
    NativeModules[name] = { open: jest.fn(), dismiss: jest.fn() };
  }
}

// Expo's window alias is not a DOM environment; initialize the official web test runtime without it.
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
Object.defineProperty(globalThis, 'window', { configurable: true, value: undefined });
require('react-native-reanimated').setUpTests();
if (windowDescriptor) {
  Object.defineProperty(globalThis, 'window', windowDescriptor);
}

jest.mock('react-native-svg', () => {
  const mockSvg = require('react-native-reanimated/src/mock-svg');
  return { ...mockSvg, default: mockSvg.Svg, Pattern: mockSvg.G };
});

// 화면을 먼저 정리(unmount)한 뒤 테스트 QueryClient를 비운다.
// 순서가 반대면 unmount 때 쿼리별 gcTime으로 정리 타이머가 다시 걸려 Jest 종료를 붙잡는다.
const { cleanup, configure } = require('@testing-library/react-native');
// 기본 1초는 변환 캐시가 비었거나 기기가 바쁠 때 첫 렌더를 기다리다 실패한다
configure({ asyncUtilTimeout: 3000 });
const { clearTestQueryClients } = require('./src/testing/query-client');
afterEach(async () => {
  await cleanup();
  clearTestQueryClients();
});

// 세션 정리가 캐시를 비운 뒤 화면이 내려가면 캐시에 없는 쿼리에 정리 타이머가 걸려 위 비우기로 취소할 수 없다.
// 저장 쿼리의 gcTime은 하루라 Jest 종료를 붙잡으므로 TanStack 타이머가 프로세스를 잡지 않게 한다.
const { timeoutManager } = require('@tanstack/react-query');
timeoutManager.setTimeoutProvider({
  setTimeout: (callback: () => void, delay: number) => {
    const timer = setTimeout(callback, delay);
    timer.unref?.();
    return timer;
  },
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
  setInterval: (callback: () => void, delay: number) => {
    const timer = setInterval(callback, delay);
    timer.unref?.();
    return timer;
  },
  clearInterval: (timer: ReturnType<typeof setInterval>) => clearInterval(timer),
});

const { resetExpoRouterMock } = require('./src/testing/mocks/expo-router');
beforeEach(() => {
  resetExpoRouterMock();
});
