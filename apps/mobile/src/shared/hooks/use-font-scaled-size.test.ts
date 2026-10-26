import { renderHook } from '@testing-library/react-native';
import { type ScaledSize, useWindowDimensions } from 'react-native';

import { useFontScaledSize } from './use-font-scaled-size';

jest.mock('react-native', () => ({
  // jest-expo 57이 설치하는 expo/fetch 글로벌이 Platform.select를 요구한다
  Platform: {
    OS: 'ios',
    select: (specifics: Record<string, unknown>) => specifics.ios ?? specifics.default,
  },
  useWindowDimensions: jest.fn(),
}));

const mockUseWindowDimensions = jest.mocked(useWindowDimensions);

const createWindowDimensions = (fontScale: number): ScaledSize => ({
  width: 390,
  height: 844,
  scale: 3,
  fontScale,
});

describe('useFontScaledSize', () => {
  it('윈도우의 글꼴 배율로 크기를 스케일링한다', async () => {
    // Given
    mockUseWindowDimensions.mockReturnValue(createWindowDimensions(1.5));
    const { result } = await renderHook(() => useFontScaledSize());

    // When
    const size = result.current(32);

    // Then
    expect(size).toBe(40);
  });

  it('글꼴 배율이 바뀌면 새 배율로 계산한다', async () => {
    // Given
    mockUseWindowDimensions.mockReturnValue(createWindowDimensions(1));
    const { result, rerender } = await renderHook(() => useFontScaledSize());

    // When
    mockUseWindowDimensions.mockReturnValue(createWindowDimensions(2));
    await rerender(undefined);

    // Then
    expect(result.current(20)).toBe(30);
  });
});
