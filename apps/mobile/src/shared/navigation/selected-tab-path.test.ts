import { renderHook } from '@testing-library/react-native';

import { toSelectedTabPath, useBindSelectedTabPath } from './selected-tab-path';

interface NavigatorState {
  index?: number;
  routeNames?: string[];
  routes: { name: string; state?: NavigatorState }[];
}

// 공용 mock의 컨테이너는 루트 상태만 쓰여 실제 컨테이너 타입 대신 읽는 모양으로 받는다
const { useNavigationContainerRef } = jest.requireMock<{
  useNavigationContainerRef: jest.Mock<{
    isReady: () => boolean;
    getRootState: () => NavigatorState;
  }>;
}>('expo-router');

function tabs(selectedTab: string) {
  return {
    name: '(tabs)',
    state: {
      index: 0,
      routes: [{ name: selectedTab, state: { routeNames: ['feed', 'friends/index'], routes: [] } }],
    },
  };
}

async function givenAppState(appState: NavigatorState) {
  useNavigationContainerRef.mockReturnValue({
    isReady: () => true,
    getRootState: () => ({ index: 0, routes: [{ name: '(app)', state: appState }] }),
  });
  await renderHook(() => useBindSelectedTabPath());
}

describe('toSelectedTabPath', () => {
  it('탭 밖 route가 맨 위여도 그 아래 탭 묶음의 고른 탭을 붙인다', async () => {
    // Given
    await givenAppState({ index: 1, routes: [tabs('(todos)'), { name: 'paywall' }] });

    // When
    const path = toSelectedTabPath('/friends');

    // Then
    expect(path).toBe('/(app)/(tabs)/(todos)/friends');
  });

  it('focus된 route 위에 남은 route의 탭 묶음은 보지 않는다', async () => {
    // Given
    await givenAppState({
      index: 0,
      routes: [tabs('(todos)'), { name: '(stale)', state: { routes: [tabs('(me)')] } }],
    });

    // When
    const path = toSelectedTabPath('/friends');

    // Then
    expect(path).toBe('/(app)/(tabs)/(todos)/friends');
  });

  it('고른 탭 Stack에 없는 화면이면 경로를 그대로 둔다', async () => {
    // Given
    await givenAppState({ index: 0, routes: [tabs('(todos)')] });

    // When
    const path = toSelectedTabPath('/weather');

    // Then
    expect(path).toBe('/weather');
  });
});
