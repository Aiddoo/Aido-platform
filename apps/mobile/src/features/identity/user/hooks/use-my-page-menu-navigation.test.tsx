import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createTestDi, stubWindowDimensions } from '@src/testing/core';
import { act, render, renderHook } from '@testing-library/react-native';
import { router, usePathname } from 'expo-router';
import { type PropsWithChildren, useState } from 'react';

import {
  type MyPageMenuPathname,
  MyPageMenuNavigationProvider,
  useIsMyPageMenuItemSelected,
  useMyPageMenuNavigate,
} from './use-my-page-menu-navigation';

const mockedUsePathname = jest.mocked(usePathname);

function Wrapper({ children }: PropsWithChildren) {
  const [container] = useState(() => createTestDi());
  return (
    <StaticDIProvider container={container}>
      <MyPageMenuNavigationProvider>{children}</MyPageMenuNavigationProvider>
    </StaticDIProvider>
  );
}

describe('useMyPageMenuNavigate', () => {
  beforeEach(() => {
    stubWindowDimensions(390);
  });

  it('좁은 화면에서는 메뉴에서 고른 화면을 마이 탭 Stack에 push한다', async () => {
    // Given
    mockedUsePathname.mockReturnValue('/mypage');
    const { result } = await renderHook(() => useMyPageMenuNavigate(), { wrapper: Wrapper });

    // When
    result.current('/settings/theme');

    // Then
    expect(router.push).toHaveBeenCalledWith('/settings/theme');
    expect(router.dismissAll).not.toHaveBeenCalled();
  });

  it('넓은 화면에서는 오른쪽 칸에 쌓인 화면을 걷고 고른 화면 하나만 연다', async () => {
    // Given
    stubWindowDimensions(1000);
    mockedUsePathname.mockReturnValue('/friends/search');
    jest.mocked(router.canDismiss).mockReturnValue(true);
    const { result } = await renderHook(() => useMyPageMenuNavigate(), { wrapper: Wrapper });

    // When
    result.current('/settings/language');

    // Then
    expect(router.dismissAll).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/settings/language');
    expect(jest.mocked(router.dismissAll).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(router.push).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('이미 보고 있는 항목을 다시 누르면 이동하지 않는다', async () => {
    // Given
    mockedUsePathname.mockReturnValue('/settings/theme');
    const { result } = await renderHook(() => useMyPageMenuNavigate(), { wrapper: Wrapper });

    // When
    result.current('/settings/theme');

    // Then
    expect(router.push).not.toHaveBeenCalled();
  });
});

function SelectionRow({
  pathname,
  onRender,
}: {
  pathname: MyPageMenuPathname;
  onRender: (isSelected: boolean) => void;
}) {
  const isSelected = useIsMyPageMenuItemSelected(pathname);
  onRender(isSelected);
  return null;
}

describe('useIsMyPageMenuItemSelected', () => {
  it('경로가 바뀌면 선택이 바뀐 항목만 다시 그린다', async () => {
    // Given
    mockedUsePathname.mockReturnValue('/settings/theme');
    const themeRender = jest.fn();
    const fontSizeRender = jest.fn();
    const languageRender = jest.fn();
    const rows = (
      <>
        <SelectionRow pathname="/settings/theme" onRender={themeRender} />
        <SelectionRow pathname="/settings/font-size" onRender={fontSizeRender} />
        <SelectionRow pathname="/settings/language" onRender={languageRender} />
      </>
    );
    const { rerender } = await render(<Wrapper>{rows}</Wrapper>);
    jest.clearAllMocks();

    // When
    mockedUsePathname.mockReturnValue('/settings/font-size');
    await act(async () => rerender(<Wrapper>{rows}</Wrapper>));

    // Then
    expect(themeRender).toHaveBeenLastCalledWith(false);
    expect(fontSizeRender).toHaveBeenLastCalledWith(true);
    expect(languageRender).not.toHaveBeenCalled();
  });

  it('넓은 화면 상세 칸에서 더 들어가도 고른 메뉴의 선택이 남고 어느 행도 다시 그리지 않는다', async () => {
    // Given
    stubWindowDimensions(1000);
    mockedUsePathname.mockReturnValue('/friends');
    const friendsRender = jest.fn();
    const themeRender = jest.fn();
    const rows = (
      <>
        <SelectionRow pathname="/friends" onRender={friendsRender} />
        <SelectionRow pathname="/settings/theme" onRender={themeRender} />
      </>
    );
    const { rerender } = await render(<Wrapper>{rows}</Wrapper>);
    expect(friendsRender).toHaveBeenLastCalledWith(true);
    jest.clearAllMocks();

    // When
    mockedUsePathname.mockReturnValue('/friends/search');
    await act(async () => rerender(<Wrapper>{rows}</Wrapper>));

    // Then
    expect(friendsRender).not.toHaveBeenCalled();
    expect(themeRender).not.toHaveBeenCalled();
  });
});
