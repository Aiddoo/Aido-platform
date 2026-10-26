import type { AppStateStatus } from 'react-native';

import { type AppStateSource, waitForSettledScreen } from './wait-for-settled-screen';

const DELAY_MS = 1_200;

const createAppState = () => {
  const listeners = new Set<(state: AppStateStatus) => void>();
  const remove = jest.fn();
  const appState: AppStateSource & { currentState: AppStateStatus } = {
    currentState: 'active',
    addEventListener: (_type, listener) => {
      listeners.add(listener);
      return {
        remove: () => {
          remove();
          listeners.delete(listener);
        },
      };
    },
  };
  const change = (state: AppStateStatus) => {
    appState.currentState = state;
    for (const listener of listeners) {
      listener(state);
    }
  };
  return { appState, change, listeners, remove };
};

describe('waitForSettledScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('축하가 가라앉을 때까지 기다린 뒤 화면이 그대로면 true로 끝나고 구독을 정리한다', async () => {
    // Given
    const { appState, listeners, remove } = createAppState();
    const controller = new AbortController();

    // When
    const settled = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: controller.signal,
      appState,
      isScreenReady: () => true,
    });
    jest.advanceTimersByTime(DELAY_MS);

    // Then
    await expect(settled).resolves.toBe(true);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  });

  it('기다리는 사이 화면이 내려가면(unmount) 타이머를 지우고 false로 끝난다', async () => {
    // Given
    const { appState, listeners } = createAppState();
    const controller = new AbortController();
    const isScreenReady = jest.fn(() => true);
    const settled = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: controller.signal,
      appState,
      isScreenReady,
    });

    // When
    controller.abort();

    // Then
    await expect(settled).resolves.toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    expect(listeners.size).toBe(0);
    jest.advanceTimersByTime(DELAY_MS);
    expect(isScreenReady).not.toHaveBeenCalled();
  });

  it('기다리는 사이 앱이 백그라운드로 가면 타이머를 지우고 false로 끝난다', async () => {
    // Given
    const { appState, change, listeners } = createAppState();
    const settled = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: new AbortController().signal,
      appState,
      isScreenReady: () => true,
    });

    // When
    change('background');

    // Then
    await expect(settled).resolves.toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    expect(listeners.size).toBe(0);
  });

  it('기다린 뒤 시트나 키보드가 올라와 있으면 false로 끝난다', async () => {
    // Given
    const { appState } = createAppState();

    // When
    const settled = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: new AbortController().signal,
      appState,
      isScreenReady: () => false,
    });
    jest.advanceTimersByTime(DELAY_MS);

    // Then
    await expect(settled).resolves.toBe(false);
  });

  it('이미 내려간 화면이나 백그라운드에서는 타이머를 걸지 않는다', async () => {
    // Given
    const { appState, change } = createAppState();
    const aborted = new AbortController();
    aborted.abort();

    // When
    const fromUnmounted = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: aborted.signal,
      appState,
      isScreenReady: () => true,
    });
    change('background');
    const fromBackground = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: new AbortController().signal,
      appState,
      isScreenReady: () => true,
    });

    // Then
    await expect(fromUnmounted).resolves.toBe(false);
    await expect(fromBackground).resolves.toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });
});
