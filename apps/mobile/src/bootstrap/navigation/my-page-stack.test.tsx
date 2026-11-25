import { stubWindowDimensions } from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import { router } from 'expo-router';
import { act, screen } from 'expo-router/testing-library';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { MyPageStack } from './my-page-stack';

jest.unmock('expo-router');

const onScreenMount = jest.fn();

function createScreen(testID: string) {
  return function RouteScreen() {
    useEffect(() => {
      onScreenMount(testID);
    }, []);
    return <Text testID={testID}>{testID}</Text>;
  };
}

async function renderMyPageStack(initialUrl: string) {
  return renderAppRoute(
    {
      _layout: {
        default: () => <MyPageStack menu={<Text testID="menu">메뉴</Text>} />,
        unstable_settings: { anchor: 'mypage/index' },
      },
      'mypage/index': createScreen('mypage'),
      'settings/notifications/index': createScreen('notifications'),
      'settings/notifications/push': createScreen('push'),
      'notifications/index': createScreen('inbox'),
    },
    { url: initialUrl },
  );
}

describe('MyPageStack', () => {
  beforeEach(() => {
    onScreenMount.mockClear();
  });

  it('좁은 화면은 메뉴 칸 없이 화면만 그린다', async () => {
    // Given
    stubWindowDimensions(390);

    // When
    await renderMyPageStack('/settings/notifications');

    // Then
    expect(screen.getByTestId('notifications')).toBeTruthy();
    expect(screen.queryByTestId('menu')).toBeNull();
  });

  it('넓은 화면은 쌓인 화면마다 본문 왼쪽에 메뉴 칸을 둔다', async () => {
    // Given
    stubWindowDimensions(1032);
    await renderMyPageStack('/settings/notifications');

    // When
    await act(() => router.push('/settings/notifications/push'));

    // Then
    expect(screen.getByTestId('push')).toBeTruthy();
    expect(screen.getAllByTestId('menu', { includeHiddenElements: true })).toHaveLength(3);
  });

  it('넓은 화면에서 첫 화면 종으로 연 알림함도 메뉴 칸 옆에 연다', async () => {
    // Given
    stubWindowDimensions(1032);
    await renderMyPageStack('/mypage');

    // When
    await act(() => router.push('/notifications'));

    // Then
    expect(screen.getByTestId('inbox')).toBeTruthy();
    expect(screen.getAllByTestId('menu', { includeHiddenElements: true })).toHaveLength(2);
  });

  it('접고 펴도 보고 있던 화면을 다시 마운트하지 않는다', async () => {
    // Given
    stubWindowDimensions(390);
    await renderMyPageStack('/settings/notifications');

    // When
    stubWindowDimensions(1032);
    await act(() => router.setParams({ posture: 'unfolded' }));

    // Then
    expect(screen.getAllByTestId('menu', { includeHiddenElements: true })).not.toHaveLength(0);

    // When
    stubWindowDimensions(390);
    await act(() => router.setParams({ posture: 'folded' }));

    // Then
    expect(screen.queryByTestId('menu', { includeHiddenElements: true })).toBeNull();
    expect(onScreenMount.mock.calls).toEqual([['mypage'], ['notifications']]);
  });

  describe('넓은 화면 상세의 전환', () => {
    beforeEach(() => {
      stubWindowDimensions(1032);
    });

    it('메뉴에서 연 첫 상세는 애니메이션·스와이프 없이 바꾸고 더 들어간 화면은 겹쳐 바꾼다', async () => {
      // Given
      await renderMyPageStack('/mypage');

      // When
      await act(() => router.push('/settings/notifications'));
      await act(() => router.push('/settings/notifications/push'));

      // Then
      expect(describeNativeScreens()).toEqual([
        { stackAnimation: undefined, gestureEnabled: undefined },
        { stackAnimation: 'none', gestureEnabled: false },
        { stackAnimation: 'fade', gestureEnabled: undefined },
      ]);
    });

    it('링크로 바로 연 상세도 첫 상세라 애니메이션 없이 연다', async () => {
      // When
      await renderMyPageStack('/settings/notifications');

      // Then
      expect(describeNativeScreens()).toEqual([
        { stackAnimation: undefined, gestureEnabled: undefined },
        { stackAnimation: 'none', gestureEnabled: false },
      ]);
    });

    it('좁은 화면으로 접으면 상세도 기본 전환이다', async () => {
      // Given
      stubWindowDimensions(390);
      await renderMyPageStack('/mypage');

      // When
      await act(() => router.push('/settings/notifications'));

      // Then
      expect(describeNativeScreens()).toEqual([
        { stackAnimation: undefined, gestureEnabled: undefined },
        { stackAnimation: undefined, gestureEnabled: undefined },
      ]);
    });
  });
});

/** 네이티브 Stack이 화면마다 받은 전환. 쌓인 순서이고 정하지 않은 값(기본 전환)은 undefined다 */
function describeNativeScreens() {
  const found: { stackAnimation: unknown; gestureEnabled: unknown }[] = [];
  const visit = (node: ReturnType<typeof screen.getByTestId>) => {
    if ('stackAnimation' in node.props) {
      found.push({
        stackAnimation: node.props.stackAnimation,
        gestureEnabled: node.props.gestureEnabled,
      });
    }
    for (const child of node.children) {
      if (typeof child !== 'string') {
        visit(child);
      }
    }
  };
  if (screen.root != null) {
    visit(screen.root);
  }
  return found;
}
