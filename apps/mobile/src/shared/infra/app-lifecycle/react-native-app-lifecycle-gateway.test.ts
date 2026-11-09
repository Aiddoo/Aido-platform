import { AppState, type AppStateStatus } from 'react-native';

import { reactNativeAppLifecycleGateway } from './react-native-app-lifecycle-gateway';

jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: jest.fn() },
}));

const mockAddEventListener = jest.mocked(AppState.addEventListener);

function setup() {
  const remove = jest.fn();
  let emitNative: (status: AppStateStatus) => void = () => {};
  mockAddEventListener.mockImplementation((_type, listener) => {
    emitNative = listener;
    return { remove };
  });
  return { remove, emitNative: (status: AppStateStatus) => emitNative(status) };
}

describe('reactNativeAppLifecycleGateway', () => {
  it('구독자가 여럿이어도 네이티브 리스너는 하나만 걸고 모두에게 알린다', () => {
    // Given
    const { emitNative } = setup();
    const first = jest.fn();
    const second = jest.fn();
    const unsubscribeFirst = reactNativeAppLifecycleGateway.subscribe(first);
    const unsubscribeSecond = reactNativeAppLifecycleGateway.subscribe(second);

    // When
    emitNative('background');

    // Then
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith('background');
    expect(second).toHaveBeenCalledWith('background');
    unsubscribeFirst();
    unsubscribeSecond();
  });

  it('마지막 구독자가 떠나면 네이티브 구독을 푼다', () => {
    // Given
    const { remove } = setup();
    const unsubscribeFirst = reactNativeAppLifecycleGateway.subscribe(jest.fn());
    const unsubscribeSecond = reactNativeAppLifecycleGateway.subscribe(jest.fn());

    // When
    unsubscribeFirst();
    const removedAfterFirst = remove.mock.calls.length;
    unsubscribeSecond();
    unsubscribeSecond();

    // Then
    expect(removedAfterFirst).toBe(0);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('다시 구독하면 네이티브 리스너를 새로 건다', () => {
    // Given
    setup();
    reactNativeAppLifecycleGateway.subscribe(jest.fn())();

    // When
    reactNativeAppLifecycleGateway.subscribe(jest.fn())();

    // Then
    expect(mockAddEventListener).toHaveBeenCalledTimes(2);
  });

  it('현재 상태는 AppState를 그대로 읽고 모르는 값은 unknown이다', () => {
    // Given
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'extension' });

    // When
    const state = reactNativeAppLifecycleGateway.getCurrentState();
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'background' });

    // Then
    expect(state).toBe('unknown');
    expect(reactNativeAppLifecycleGateway.getCurrentState()).toBe('background');
  });
});
