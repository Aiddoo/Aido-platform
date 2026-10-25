import { mockWindowDimensions } from '@src/shared/__tests__';
import { renderHook } from '@testing-library/react-native';

import { useWindowSizeClass } from './use-window-size-class';

jest.mock('../config/device', () => ({ IS_IOS_APP_ON_MAC: true }));

describe('useWindowSizeClass', () => {
  it('Mac에서는 창이 넓어도 모바일 레이아웃(compact)을 유지한다', async () => {
    // Given
    mockWindowDimensions(1200);

    // When
    const { result } = await renderHook(() => useWindowSizeClass());

    // Then
    expect(result.current).toBe('compact');
  });
});
