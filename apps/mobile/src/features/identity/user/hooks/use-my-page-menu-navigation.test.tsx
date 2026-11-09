import { stubWindowDimensions } from '@src/shared/__tests__';
import { renderHook } from '@testing-library/react-native';
import { router, usePathname } from 'expo-router';

import { useMyPageMenuNavigation } from './use-my-page-menu-navigation';

const mockedUsePathname = jest.mocked(usePathname);

describe('useMyPageMenuNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubWindowDimensions(390);
  });

  it('좁은 화면에서는 메뉴에서 고른 화면을 마이 탭 Stack에 push한다', async () => {
    // Given
    mockedUsePathname.mockReturnValue('/mypage');
    const { result } = await renderHook(() => useMyPageMenuNavigation());

    // When
    result.current.navigate('/settings/theme');

    // Then
    expect(router.push).toHaveBeenCalledWith('/settings/theme');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('넓은 화면에서는 오른쪽 칸에 쌓인 화면을 걷고 고른 화면 하나만 연다', async () => {
    // Given
    stubWindowDimensions(1000);
    mockedUsePathname.mockReturnValue('/friends/search');
    jest.mocked(router.canDismiss).mockReturnValue(true);
    const { result } = await renderHook(() => useMyPageMenuNavigation());

    // When
    result.current.navigate('/settings/language');

    // Then
    expect(router.dismissAll).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/settings/language');
    expect(jest.mocked(router.dismissAll).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(router.push).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('넓은 화면에서 오른쪽 칸이 비어 있으면 걷지 않고 연다', async () => {
    // Given
    stubWindowDimensions(1000);
    mockedUsePathname.mockReturnValue('/mypage');
    jest.mocked(router.canDismiss).mockReturnValue(false);
    const { result } = await renderHook(() => useMyPageMenuNavigation());

    // When
    result.current.navigate('/friends');

    // Then
    expect(router.dismissAll).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/friends');
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

    // When
    const isThemeSelected = result.current.isSelected('/settings/theme');
    const isLanguageSelected = result.current.isSelected('/settings/language');

    // Then
    expect(isThemeSelected).toBe(true);
    expect(isLanguageSelected).toBe(false);
  });
});
