import { setupFakeTimersPerTest } from '@src/testing/core';
import { act, renderHook } from '@testing-library/react-native';
import { range } from 'es-toolkit';
import { AccessibilityInfo } from 'react-native';

import { useDemoScript } from './use-demo-script';

const SCRIPT = { frameCount: 3, frameMs: 100, startDelayMs: 50 } as const;

let mockIsReducedMotion = false;

describe('useDemoScript', () => {
  setupFakeTimersPerTest();

  beforeEach(() => {
    mockIsReducedMotion = false;
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockImplementation(async () => mockIsReducedMotion);
  });

  it('장면 번호를 정해진 간격으로 한 번씩 넘긴다', async () => {
    // Given
    const { result } = await renderHook(() => useDemoScript(SCRIPT));

    // When
    await act(() => jest.advanceTimersByTimeAsync(SCRIPT.startDelayMs + SCRIPT.frameMs));

    // Then
    expect(result.current).toBe(2);
  });

  it('장면이 사라지면 남은 장면 타이머를 지운다', async () => {
    // Given
    const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
    const { unmount } = await renderHook(() => useDemoScript(SCRIPT));
    const frameDelays = range(SCRIPT.frameCount).map(
      (index) => SCRIPT.startDelayMs + index * SCRIPT.frameMs,
    );
    const frameTimers = setTimeoutSpy.mock.calls.flatMap(([, delay], index) =>
      frameDelays.includes(delay ?? 0) ? [setTimeoutSpy.mock.results[index]?.value] : [],
    );

    // When
    await unmount();

    // Then
    expect(frameTimers).toHaveLength(SCRIPT.frameCount);
    expect(clearTimeoutSpy.mock.calls.map(([timer]) => timer)).toEqual(
      expect.arrayContaining(frameTimers),
    );
  });

  it('움직임 줄이기면 타이머 없이 마지막 장면을 바로 보여 준다', async () => {
    // Given
    mockIsReducedMotion = true;

    // When
    const { result } = await renderHook(() => useDemoScript(SCRIPT));
    await act(async () => undefined);

    // Then
    expect(result.current).toBe(SCRIPT.frameCount);
  });
});
