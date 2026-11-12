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
});
