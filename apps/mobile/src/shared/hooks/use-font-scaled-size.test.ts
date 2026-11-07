import { mockWindowDimensions } from '@src/shared/__tests__';
import { renderHook } from '@testing-library/react-native';

import { useFontScaledSize } from './use-font-scaled-size';

describe('useFontScaledSize', () => {
  it('윈도우의 글꼴 배율로 크기를 스케일링한다', async () => {
    // Given
    mockWindowDimensions(390, 844, 1.5);
    const { result } = await renderHook(() => useFontScaledSize());

    // When
    const size = result.current(32);

    // Then
    expect(size).toBe(40);
  });

  it('글꼴 배율이 바뀌면 새 배율로 계산한다', async () => {
    // Given
    mockWindowDimensions(390, 844, 1);
    const { result, rerender } = await renderHook(() => useFontScaledSize());

    // When
    mockWindowDimensions(390, 844, 2);
    await rerender(undefined);

    // Then
    expect(result.current(20)).toBe(30);
  });
});
