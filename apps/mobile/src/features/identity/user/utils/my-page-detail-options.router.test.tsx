import { router, Stack } from 'expo-router';
import { act, renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import {
  clearMyPageDetailRootRequest,
  getMyPageDetailOptions,
  requestMyPageDetailRoot,
} from './my-page-detail-options';

// 실제 라우터로 화면이 처음 그려질 때 받는 옵션을 본다
jest.unmock('expo-router');

const optionsLog: {
  name: string;
  headerBackVisible: boolean | undefined;
  animation: string | undefined;
}[] = [];

function createScreen(testID: string) {
  return function RouteScreen() {
    return <Text testID={testID}>{testID}</Text>;
  };
}

async function renderPane(initialUrl: string) {
  return renderRouter(
    {
      _layout: {
        default: () => (
          <Stack
            screenOptions={(input) => {
              const options = getMyPageDetailOptions(input);
              optionsLog.push({
                name: input.route.name,
                headerBackVisible: options.headerBackVisible,
                animation: options.animation,
              });
              return { animation: 'none', ...options };
            }}
          />
        ),
        unstable_settings: { anchor: 'index' },
      },
      index: createScreen('menu'),
      'friends/index': createScreen('friends'),
      'friends/search': createScreen('friends-search'),
      'settings/theme': createScreen('theme'),
    },
    { initialUrl },
  );
}

function firstOptionsOf(name: string) {
  return optionsLog.find((entry) => entry.name === name);
}

describe('getMyPageDetailOptions (실제 라우터)', () => {
  beforeEach(() => {
    optionsLog.length = 0;
    clearMyPageDetailRootRequest();
  });

  it('비어 있는 칸에서 연 첫 상세는 처음 그릴 때부터 뒤로 가기가 없다', async () => {
    // Given
    await renderPane('/');

    // When
    await act(() => router.push('/friends'));

    // Then
    expect(firstOptionsOf('friends/index')?.headerBackVisible).toBe(false);
  });

  it('첫 상세에서 더 들어간 화면은 처음 그릴 때부터 뒤로 가기가 있다', async () => {
    // Given
    await renderPane('/');
    await act(() => router.push('/friends'));

    // When
    await act(() => router.push('/friends/search'));

    // Then
    expect(firstOptionsOf('friends/search')).toMatchObject({
      headerBackVisible: undefined,
      animation: 'fade',
    });
  });

  it('더 들어간 상태에서 다른 메뉴를 고르면 새 첫 상세도 처음부터 뒤로 가기가 없다', async () => {
    // Given
    await renderPane('/');
    await act(() => router.push('/friends'));
    await act(() => router.push('/friends/search'));

    // When
    await act(() => {
      requestMyPageDetailRoot('/settings/theme');
      router.dismissAll();
      router.push('/settings/theme');
    });

    // Then
    expect(firstOptionsOf('settings/theme')?.headerBackVisible).toBe(false);
  });

  it('링크로 바로 연 상세는 처음부터 뒤로 가기가 없다', async () => {
    // When
    await renderPane('/settings/theme');

    // Then
    expect(firstOptionsOf('settings/theme')?.headerBackVisible).toBe(false);
  });
});
