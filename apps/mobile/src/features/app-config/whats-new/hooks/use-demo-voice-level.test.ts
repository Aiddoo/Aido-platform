import { setupFakeTimersPerTest } from '@src/testing/core';
import { act, renderHook } from '@testing-library/react-native';

import { useDemoVoiceLevel } from './use-demo-voice-level';

/** 예시 음량 한 칸(120ms)보다 길게 흘려 값이 움직였는지 본다 */
const SPEAKING_MS = 600;

describe('useDemoVoiceLevel', () => {
  setupFakeTimersPerTest();

  it('말하는 동안 UI 스레드에서 음량이 오르내린다', async () => {
    // Given
    const { result } = await renderHook(() => useDemoVoiceLevel({ isSpeaking: true }));

    // When
    await act(() => jest.advanceTimersByTimeAsync(SPEAKING_MS));

    // Then
    expect(result.current.get()).toBeGreaterThan(0);
  });

  it('말이 끝나면 0으로 내려앉는다', async () => {
    // Given
    const { result, rerender } = await renderHook(
      ({ isSpeaking }: { isSpeaking: boolean }) => useDemoVoiceLevel({ isSpeaking }),
      { initialProps: { isSpeaking: true } },
    );
    await act(() => jest.advanceTimersByTimeAsync(SPEAKING_MS));

    // When
    await rerender({ isSpeaking: false });
    await act(() => jest.advanceTimersByTimeAsync(SPEAKING_MS));

    // Then
    expect(result.current.get()).toBe(0);
  });

  it('장면이 사라지면 반복하던 음량 애니메이션을 멈춘다', async () => {
    // Given
    const { result, unmount } = await renderHook(() => useDemoVoiceLevel({ isSpeaking: true }));
    await act(() => jest.advanceTimersByTimeAsync(SPEAKING_MS));
    const level = result.current;

    // When
    await unmount();
    const levelAtUnmount = level.get();
    await act(() => jest.advanceTimersByTimeAsync(SPEAKING_MS));

    // Then
    expect(level.get()).toBe(levelAtUnmount);
  });
});
