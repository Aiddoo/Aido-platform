import { renderHook } from '@testing-library/react-native';
import { router, usePathname } from 'expo-router';

import { useCheckoutRoute } from './use-checkout-route';

describe('useCheckoutRoute', () => {
  it('업셀 모달에서는 같은 모달 안에서 이동하고, 기능으로 떠날 때 모달을 닫고 기존 탭에서 연다', async () => {
    // Given
    jest.mocked(usePathname).mockReturnValue('/paywall');
    const { result } = await renderHook(() => useCheckoutRoute());
    const [pathname, leaveTo] = result.current;

    // When
    leaveTo('/reports');

    // Then
    expect(pathname).toBe('/paywall');
    expect(router.dismissTo).toHaveBeenCalledWith('/reports');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('마이 탭 구독 관리에서는 그 Stack에 이어 연다', async () => {
    // Given
    jest.mocked(usePathname).mockReturnValue('/settings/subscription');
    const { result } = await renderHook(() => useCheckoutRoute());
    const [pathname, leaveTo] = result.current;

    // When
    leaveTo('/reports');

    // Then
    expect(pathname).toBe('/settings/subscription');
    expect(router.push).toHaveBeenCalledWith('/reports');
    expect(router.dismissTo).not.toHaveBeenCalled();
  });
});
