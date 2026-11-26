import { cleanup } from '@testing-library/react-native';

interface IdleCallbacks {
  request: (callback: IdleRequestCallback) => number;
  cancel: (handle: number) => void;
}

const IDLE_CALLBACK_NAMES = ['requestIdleCallback', 'cancelIdleCallback'] as const;

/** 한가해지기를 기다리지 않고 바로 부른다 */
function runImmediately(): IdleCallbacks {
  return {
    request: (callback) => {
      callback({ didTimeout: false, timeRemaining: () => 10 });
      return 1;
    },
    cancel: () => undefined,
  };
}

/**
 * Jest 환경에는 한가할 때 부르는 콜백(`requestIdleCallback`)이 없다. describe 안 테스트마다 넣고(기본은 바로 부른다)
 * 끝나면 원래대로 되돌린다. 언제 부를지 테스트가 정하려면 테스트마다 새로 만드는 함수를 넘긴다
 */
export function setupIdleCallbackPerTest(createCallbacks: () => IdleCallbacks = runImmediately) {
  let originals = new Map<string, PropertyDescriptor | undefined>();

  beforeEach(() => {
    originals = new Map(
      IDLE_CALLBACK_NAMES.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
    );
    const { request, cancel } = createCallbacks();
    Object.defineProperty(globalThis, 'requestIdleCallback', {
      configurable: true,
      value: request,
    });
    Object.defineProperty(globalThis, 'cancelIdleCallback', { configurable: true, value: cancel });
  });

  // 안쪽 afterEach가 공용 cleanup보다 먼저 돈다. 화면을 먼저 내려 effect 정리가 cancelIdleCallback을 부를 수 있게 한다
  afterEach(async () => {
    await cleanup();
    for (const [name, descriptor] of originals) {
      if (descriptor == null) {
        Reflect.deleteProperty(globalThis, name);
      } else {
        Object.defineProperty(globalThis, name, descriptor);
      }
    }
  });
}
