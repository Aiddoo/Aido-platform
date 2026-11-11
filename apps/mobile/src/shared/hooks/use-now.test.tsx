import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { fromEpochMs, toEpochMs, type Instant } from '@src/shared/date/instant';
import {
  createAppLifecycleGatewayStub,
  createTestDi,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { useNow } from './use-now';

const START_MS = Date.UTC(2026, 6, 14, 12, 0, 0);

interface UseNowProps {
  tickMs?: number;
  until?: Instant | null;
  isEnabled?: boolean;
}

async function setup(initialProps: UseNowProps) {
  const appLifecycle = createAppLifecycleGatewayStub();
  function wrapper({ children }: PropsWithChildren) {
    return (
      <StaticDIProvider container={createTestDi({ appLifecycle })}>{children}</StaticDIProvider>
    );
  }
  const hook = await renderHook((props: UseNowProps) => useNow(props), {
    wrapper,
    initialProps,
  });
  return { ...hook, appLifecycle };
}

/** 틱마다 렌더와 effect가 끝나야 다음 타이머가 걸려 act를 나눠 흘린다 */
async function advance(ms: number, stepMs = 500) {
  for (let elapsedMs = 0; elapsedMs < ms; elapsedMs += stepMs) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(Math.min(stepMs, ms - elapsedMs));
    });
  }
}

describe('useNow', () => {
  setupFakeTimersPerTest({ now: START_MS });

  it('tickMs마다 지금을 다시 읽는다', async () => {
    // Given
    const { result } = await setup({ tickMs: 1_000 });

    // When
    await advance(3_000);

    // Then
    expect(toEpochMs(result.current)).toBe(START_MS + 3_000);
  });

  it('until이 지나면 더 읽지 않는다', async () => {
    // Given
    const { result } = await setup({ tickMs: 1_000, until: fromEpochMs(START_MS + 2_500) });

    // When
    await advance(10_000);

    // Then
    // 2.5초 끝은 500ms 나머지에 맞춰 읽고 마감 뒤에는 멈춘다
    expect(toEpochMs(result.current)).toBe(START_MS + 2_500);
  });

  it('tickMs 없이 until만 주면 그 순간에 한 번만 읽는다', async () => {
    // Given
    const { result } = await setup({ until: fromEpochMs(START_MS + 5_000) });

    // When
    await advance(4_000);
    const beforeUntil = toEpochMs(result.current);
    await advance(2_000);

    // Then
    expect(beforeUntil).toBe(START_MS);
    expect(toEpochMs(result.current)).toBe(START_MS + 5_000);
  });

  it('꺼 두면 읽지 않고 켜는 순간 지금을 새로 읽는다', async () => {
    // Given
    const { result, rerender } = await setup({ tickMs: 1_000, isEnabled: false });

    // When
    await advance(5_000);
    const whileDisabled = toEpochMs(result.current);
    await rerender({ tickMs: 1_000, isEnabled: true });

    // Then
    expect(whileDisabled).toBe(START_MS);
    expect(toEpochMs(result.current)).toBe(START_MS + 5_000);
  });

  it('앱으로 돌아오면 타이머를 기다리지 않고 지금을 다시 읽는다', async () => {
    // Given
    const { result, appLifecycle } = await setup({ tickMs: 60_000 });
    await act(async () => appLifecycle.emit('background'));
    jest.setSystemTime(START_MS + 30_000);

    // When
    await act(async () => appLifecycle.emit('active'));

    // Then
    expect(toEpochMs(result.current)).toBe(START_MS + 30_000);
  });
});
