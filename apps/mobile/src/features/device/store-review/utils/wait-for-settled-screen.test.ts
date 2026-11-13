import { createAppLifecycleGatewayStub } from '@src/testing/core';
import { setupFakeTimersPerTest } from '@src/testing/timers';

import { waitForSettledScreen } from './wait-for-settled-screen';

const DELAY_MS = 1_200;

describe('waitForSettledScreen', () => {
  setupFakeTimersPerTest();

  it('축하가 가라앉을 때까지 기다린 뒤 화면이 그대로면 true로 끝나고 구독을 정리한다', async () => {
    // Given
    const appLifecycle = createAppLifecycleGatewayStub();
    const controller = new AbortController();

    // When
    const settled = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: controller.signal,
      appLifecycle,
      isScreenReady: () => true,
    });
    jest.advanceTimersByTime(DELAY_MS);

    // Then
    await expect(settled).resolves.toBe(true);
    expect(appLifecycle.getListenerCount()).toBe(0);
  });

  it('기다리는 사이 화면이 내려가면(unmount) 타이머를 지우고 false로 끝난다', async () => {
    // Given
    const appLifecycle = createAppLifecycleGatewayStub();
    const controller = new AbortController();
    const isScreenReady = jest.fn(() => true);
    const settled = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: controller.signal,
      appLifecycle,
      isScreenReady,
    });

    // When
    controller.abort();

    // Then
    await expect(settled).resolves.toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    expect(appLifecycle.getListenerCount()).toBe(0);
    jest.advanceTimersByTime(DELAY_MS);
    expect(isScreenReady).not.toHaveBeenCalled();
  });

  it('기다리는 사이 앱이 백그라운드로 가면 타이머를 지우고 false로 끝난다', async () => {
    // Given
    const appLifecycle = createAppLifecycleGatewayStub();
    const settled = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: new AbortController().signal,
      appLifecycle,
      isScreenReady: () => true,
    });

    // When
    appLifecycle.emit('background');

    // Then
    await expect(settled).resolves.toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    expect(appLifecycle.getListenerCount()).toBe(0);
  });

  it('기다린 뒤 시트나 키보드가 올라와 있으면 false로 끝난다', async () => {
    // Given
    const appLifecycle = createAppLifecycleGatewayStub();

    // When
    const settled = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: new AbortController().signal,
      appLifecycle,
      isScreenReady: () => false,
    });
    jest.advanceTimersByTime(DELAY_MS);

    // Then
    await expect(settled).resolves.toBe(false);
  });

  it('이미 내려간 화면이나 백그라운드에서는 타이머를 걸지 않는다', async () => {
    // Given
    const appLifecycle = createAppLifecycleGatewayStub();
    const aborted = new AbortController();
    aborted.abort();

    // When
    const fromUnmounted = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: aborted.signal,
      appLifecycle,
      isScreenReady: () => true,
    });
    appLifecycle.emit('background');
    const fromBackground = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: new AbortController().signal,
      appLifecycle,
      isScreenReady: () => true,
    });

    // Then
    await expect(fromUnmounted).resolves.toBe(false);
    await expect(fromBackground).resolves.toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });
});
