import { renderAppRoute } from '@src/testing/render-route-hook';
import { router, Stack, Tabs } from 'expo-router';
import { act } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { openEntryHref } from './open-entry-href';

// 실제 라우터로 Stack 기록을 보므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

interface RouteState {
  routes: { name: string; state?: RouteState }[];
  index?: number;
}

function createScreen(testID: string) {
  return function RouteScreen() {
    return <Text testID={testID}>{testID}</Text>;
  };
}

function createTabStackLayout(anchor: string) {
  return {
    default: () => <Stack screenOptions={{ headerShown: false, animation: 'none' }} />,
    unstable_settings: { anchor },
  };
}

// 앱과 같은 모양의 트리: 탭 위 Stack, 탭마다 Stack, 세 탭이 함께 쓰는 화면(app/(app)/(tabs))
async function renderApp(url: string) {
  const routes = {
    _layout: () => <Stack screenOptions={{ headerShown: false, animation: 'none' }} />,
    '(app)/_layout': createTabStackLayout('(tabs)'),
    // NativeTabs는 Jest에서 그려지지 않아 같은 탭 라우터를 쓰는 JS Tabs로 대신한다
    '(app)/(tabs)/_layout': {
      default: () => (
        <Tabs screenOptions={{ headerShown: false, lazy: false }}>
          <Tabs.Screen name="(todos)" />
          <Tabs.Screen name="(memos)" />
          <Tabs.Screen name="(me)" />
        </Tabs>
      ),
      unstable_settings: { anchor: '(todos)' },
    },
    '(app)/(tabs)/(todos)/_layout': createTabStackLayout('feed/index'),
    '(app)/(tabs)/(memos)/_layout': createTabStackLayout('memo/index'),
    '(app)/(tabs)/(me)/_layout': createTabStackLayout('mypage/index'),
    '(app)/(tabs)/(todos)/feed/index': createScreen('feed'),
    '(app)/(tabs)/(memos)/memo/index': createScreen('memo'),
    '(app)/(tabs)/(me)/mypage/index': createScreen('mypage'),
    '(app)/(tabs)/(me,memos,todos)/friends/index': createScreen('friends'),
    '(app)/(tabs)/(me,memos,todos)/settings/theme': createScreen('theme'),
    '(app)/notifications/index': createScreen('notifications'),
    '(app)/todo/[todoId]/index': createScreen('todo'),
  };
  // Metro는 route 파일을 경로 순으로 올리고, 탭이 정해지지 않은 이동이 고르는 그룹이 이 순서를 따른다
  const rendered = await renderAppRoute(
    Object.fromEntries(Object.entries(routes).sort(([a], [b]) => (a < b ? -1 : 1))),
    { url },
  );

  const findAppStack = () => findNavigator(rendered.getRouterState(), ['__root', '(app)']);
  /** 탭 위 Stack(`(app)`)에 쌓인 화면 이름 */
  const appStack = () => findAppStack()?.routes.map(({ name }) => name);
  /** 지금 탭의 Stack에 쌓인 화면 이름 */
  const tabStack = () => {
    const tabs = findNavigator(findAppStack(), ['(tabs)']);
    const tab = tabs?.routes[tabs.index ?? 0];
    return tab?.state?.routes.map(({ name }) => name);
  };

  return { ...rendered, appStack, tabStack };
}

/** 이름 경로를 따라 내려간 navigator. 같은 이름이 여럿이면 맨 위의 것이다 */
function findNavigator(state: RouteState | undefined, names: string[]): RouteState | undefined {
  return names.reduce<RouteState | undefined>(
    (current, name) => current?.routes.findLast((route) => route.name === name)?.state,
    state,
  );
}

describe('openEntryHref', () => {
  it('탭 위 화면(알림함)에서 탭 화면을 열면 탭 위 화면을 닫고 탭 묶음을 하나만 둔다', async () => {
    // Given
    const app = await renderApp('/feed');
    await act(() => router.push('/notifications'));

    // When
    await act(() => openEntryHref('/feed?date=today'));

    // Then
    expect(app.getPathname()).toBe('/feed');
    expect(app.appStack()).toEqual(['(tabs)']);
  });

  it('탭 위 화면(알림함)에서 함께 쓰는 화면을 열면 탭 위 화면을 닫고 마이 탭에 연다', async () => {
    // Given
    const app = await renderApp('/feed');
    await act(() => router.push('/notifications'));

    // When
    await act(() => openEntryHref('/friends?view=receiver'));

    // Then
    expect(app.getSegments()).toEqual(['(app)', '(tabs)', '(me)', 'friends']);
    expect(app.appStack()).toEqual(['(tabs)']);

    // When
    await act(() => router.back());

    // Then
    expect(app.getPathname()).toBe('/mypage');
  });

  it('할 일 상세 위에서 피드를 열어도 탭 묶음이 두 겹이 되지 않는다', async () => {
    // Given
    const app = await renderApp('/feed');
    await act(() => router.push('/todo/7'));

    // When
    await act(() => openEntryHref('/feed?date=today'));

    // Then
    expect(app.getPathname()).toBe('/feed');
    expect(app.appStack()).toEqual(['(tabs)']);
  });

  it('탭 Stack에 이미 있는 첫 화면은 다시 쌓지 않고 그리로 돌아간다', async () => {
    // Given
    const app = await renderApp('/feed');
    await act(() => router.push('/friends'));

    // When
    await act(() => openEntryHref('/feed?date=today'));

    // Then
    expect(app.getPathname()).toBe('/feed');
    expect(app.tabStack()).toEqual(['feed/index']);
  });

  it('지금 탭에 없는 함께 쓰는 화면은 그 탭에 쌓고 뒤로 가면 보던 화면이다', async () => {
    // Given
    const app = await renderApp('/mypage');
    await act(() => router.push('/settings/theme'));

    // When
    await act(() => openEntryHref('/friends?view=receiver'));

    // Then
    expect(app.getSegments()).toEqual(['(app)', '(tabs)', '(me)', 'friends']);
    expect(app.tabStack()).toEqual(['mypage/index', 'settings/theme', 'friends/index']);

    // When
    await act(() => router.back());

    // Then
    expect(app.getPathname()).toBe('/settings/theme');
  });

  it('같은 화면이 맨 위에 있으면 params만 바꾸고 다시 쌓지 않는다', async () => {
    // Given
    const app = await renderApp('/feed');
    await act(() => router.push('/friends?view=sender'));

    // When
    await act(() => openEntryHref('/friends?view=receiver'));

    // Then
    expect(app.getSearchParams()).toEqual({ view: 'receiver' });
    expect(app.tabStack()).toEqual(['feed/index', 'friends/index']);
  });

  it('같은 할 일 상세는 다시 쌓지 않고 다른 할 일은 그 위에 쌓는다', async () => {
    // Given
    const app = await renderApp('/feed');
    await act(() => openEntryHref('/todo/42'));

    // When
    await act(() => openEntryHref('/todo/42?comment=c1'));

    // Then
    expect(app.appStack()).toEqual(['(tabs)', 'todo/[todoId]/index']);
    expect(app.getSearchParams()).toEqual({ todoId: '42', comment: 'c1' });

    // When
    await act(() => openEntryHref('/todo/43'));

    // Then
    expect(app.appStack()).toEqual(['(tabs)', 'todo/[todoId]/index', 'todo/[todoId]/index']);
  });

  it('Stack 아래에 있는 탭 위 화면은 다시 쌓지 않고 그리로 돌아간다', async () => {
    // Given
    const app = await renderApp('/feed');
    await act(() => router.push('/notifications'));
    await act(() => router.push('/todo/7'));

    // When
    await act(() => openEntryHref('/notifications'));

    // Then
    expect(app.getPathname()).toBe('/notifications');
    expect(app.appStack()).toEqual(['(tabs)', 'notifications/index']);
  });
});
