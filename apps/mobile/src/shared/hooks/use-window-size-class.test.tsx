import { renderHook } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';

import { useWindowSizeClass } from './use-window-size-class';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedUseWindowDimensions = jest.mocked(useWindowDimensions);

describe('useWindowSizeClass', () => {
  it.each([
    [320, 'compact'],
    [599, 'compact'],
    [600, 'medium'],
    [839, 'medium'],
    [840, 'expanded'],
    [1200, 'expanded'],
  ])('창 폭 %ddp는 %s로 분류한다', async (width, expected) => {
    // Given
    mockedUseWindowDimensions.mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 });

    // When
    const { result } = await renderHook(() => useWindowSizeClass());

    // Then
    expect(result.current).toBe(expected);
  });
});
