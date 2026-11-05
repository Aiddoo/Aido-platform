import { renderHook } from '@testing-library/react-native';
import { router, usePathname } from 'expo-router';

import { useMyPageMenuNavigation } from './use-mypage-menu-navigation';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), dismissAll: jest.fn() },
  usePathname: jest.fn(),
  useRootNavigationState: jest.fn(),
}));

const mockedUsePathname = jest.mocked(usePathname);

describe('useMyPageMenuNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('마이페이지 탭에서는 설정 항목으로 push한다', async () => {
    // Given
    mockedUsePathname.mockReturnValue('/mypage');
    const { result } = await renderHook(() => useMyPageMenuNavigation());

    // When
    result.current.navigate('/settings/theme');

    // Then
    expect(router.push).toHaveBeenCalledWith('/settings/theme');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('설정 화면에서는 다른 설정 항목으로 상세를 교체한다', async () => {
    // Given
    mockedUsePathname.mockReturnValue('/settings/theme');
    const { result } = await renderHook(() => useMyPageMenuNavigation());

    // When
    result.current.navigate('/settings/language');

    // Then
    expect(router.replace).toHaveBeenCalledWith('/settings/language');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('이미 보고 있는 항목을 다시 누르면 이동하지 않는다', async () => {
    // Given
    mockedUsePathname.mockReturnValue('/settings/theme');
    const { result } = await renderHook(() => useMyPageMenuNavigation());

    // When
    result.current.navigate('/settings/theme');

    // Then
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('현재 설정 화면에 해당하는 항목만 선택 상태로 본다', async () => {
    // Given
    mockedUsePathname.mockReturnValue('/settings/theme');
    const { result } = await renderHook(() => useMyPageMenuNavigation());

    // Then
    expect(result.current.isSelected('/settings/theme')).toBe(true);
    expect(result.current.isSelected('/settings/language')).toBe(false);
  });
});
