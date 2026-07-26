import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { usePrefersReducedMotion } from './use-prefers-reduced-motion';

describe('usePrefersReducedMotion', () => {
  it('시스템의 모션 감소 설정을 반영한다', async () => {
    // Given
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);

    // When
    const { result } = await renderHook(() => usePrefersReducedMotion());

    // Then
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('런타임 설정 변경을 즉시 반영한다', async () => {
    // Given
    let listener: ((enabled: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      _event: string,
      callback: (enabled: boolean) => void,
    ) => {
      listener = callback;
      return { remove: jest.fn() };
    }) as never);
    const { result } = await renderHook(() => usePrefersReducedMotion());
    await waitFor(() => expect(result.current).toBe(false));

    // When
    await act(async () => listener?.(true));

    // Then
    expect(result.current).toBe(true);
  });
});
