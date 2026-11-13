import { router } from '@src/testing/mocks/expo-router';
import { renderHook } from '@testing-library/react-native';

import { useGoBack } from './use-go-back';

describe('useGoBack', () => {
  it('돌아갈 화면이 있으면 뒤로 간다', async () => {
    // Given
    router.canGoBack.mockReturnValue(true);
    const { result } = await renderHook(() => useGoBack({ fallbackHref: '/feed' }));

    // When
    result.current();

    // Then
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('돌아갈 화면이 없으면 fallback 화면으로 바꾼다', async () => {
    // Given
    router.canGoBack.mockReturnValue(false);
    const { result } = await renderHook(() => useGoBack({ fallbackHref: '/feed' }));

    // When
    result.current();

    // Then
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/feed');
  });

  it('돌아갈 화면이 없으면 화면 대신 onFallback을 한 번 부른다', async () => {
    // Given
    router.canGoBack.mockReturnValue(false);
    const onFallback = jest.fn();
    const { result } = await renderHook(() => useGoBack({ onFallback }));

    // When
    result.current();
    result.current();

    // Then
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('fallback이 없고 돌아갈 화면도 없으면 아무것도 하지 않는다', async () => {
    // Given
    router.canGoBack.mockReturnValue(false);
    const { result } = await renderHook(() => useGoBack());

    // When
    result.current();

    // Then
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('연타해도 한 번만 이동한다', async () => {
    // Given
    router.canGoBack.mockReturnValue(true);
    const { result } = await renderHook(() => useGoBack({ fallbackHref: '/feed' }));

    // When
    result.current();
    result.current();

    // Then
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
