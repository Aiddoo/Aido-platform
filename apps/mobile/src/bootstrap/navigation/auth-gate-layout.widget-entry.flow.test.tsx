import { ok } from '@src/core/errors/result';
import type { AuthStatus } from '@src/core/session/auth-status';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { getNowInstant } from '@src/shared/date/clock';
import {
  createHttpClientStub,
  createTestDi,
  respondByPath,
  stubWindowDimensions,
} from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import * as ExpoLinking from 'expo-linking';
import { router, Stack, Tabs, useLocalSearchParams } from 'expo-router';
import { act, screen, waitFor } from 'expo-router/testing-library';
import { Linking, Text } from 'react-native';

import { unstable_settings as meTabSettings } from '../../../app/(app)/(tabs)/(me)/_layout';
import { unstable_settings as todosTabSettings } from '../../../app/(app)/(tabs)/(todos)/_layout';
import { unstable_settings as tabsSettings } from '../../../app/(app)/(tabs)/_layout';
import * as NativeIntent from '../../../app/+native-intent';
import RootIndex from '../../../app/index';
import { AuthGateLayout } from './auth-gate-layout';
import { clearColdStartPath } from './cold-start-link';

// 실제 라우터로 URL·탭·뒤로 가기 목적지를 검증하므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

const ME = createCurrentUserDto();
/** 초대한 친구. 초대를 받아들이면 환영 화면 경로(`/invite-welcome/[friendId]`)에 이 id가 실린다 */
const INVITER_ID = 'clz7x5p8k0002qz0z8z8z8z8z';

function createScreen(testID: string) {
  return function RouteScreen() {
    return <Text testID={testID}>{testID}</Text>;
  };
}

/** 피드가 실제로 받은 params. 앱 전체 URL 값에는 앞 화면 param이 남을 수 있어 화면이 읽는 값을 본다 */
function FeedScreen() {
  return <Text testID="feed">{JSON.stringify(useLocalSearchParams())}</Text>;
}

function feedParams(): unknown {
  return JSON.parse(String(screen.getByTestId('feed').props.children));
}

interface StackNode {
  name: string;
  state?: { routes: StackNode[] };
}

/** 루트 Stack에 쌓인 route와 그 바로 안 route 이름. 탭 묶음이 두 번 쌓였는지 본다 */
function describeRootStack(rootState: unknown): string[] {
  const [root] = isStackState(rootState) ? rootState.routes : [];
  return (
    root?.state?.routes.map((node) =>
      node.state == null
        ? node.name
        : `${node.name}[${node.state.routes.map(({ name }) => name).join(',')}]`,
    ) ?? []
  );
}

function isStackState(value: unknown): value is { routes: StackNode[] } {
  return typeof value === 'object' && value != null && 'routes' in value;
}

/** OS가 위젯 URI로 꺼진 앱을 연다. `+native-intent`를 거친 경로로 시작하고 Linking도 그 URI를 처음 URL로 준다 */
function toColdStartUrl(widgetUri: string) {
  jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue(widgetUri);
  const path = NativeIntent.redirectSystemPath({ path: widgetUri, initial: true });
  return path.replace(/^[a-z-]+:\/\//, '/');
}

async function setup({ status, url }: { status: AuthStatus; url: string }) {
  const authSessionStore = createAuthSessionStoreStub(status);
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(respondByPath({ 'v1/auth/me': ok(ME) }));
  const di = createTestDi({ ports: { httpClient }, seeds: { authSessionStore } });

  const routes = {
    _layout: AuthGateLayout,
    index: RootIndex,
    loading: createScreen('loading'),
    'invite/index': createScreen('invite'),
    '(auth)/_layout': () => <Stack screenOptions={{ animation: 'none' }} />,
    '(auth)/login': createScreen('login'),
    '(app)/_layout': {
      default: () => <Stack screenOptions={{ headerShown: false, animation: 'none' }} />,
      unstable_settings: { anchor: '(tabs)' },
    },
    // NativeTabs는 Jest에서 그려지지 않아 같은 탭 라우터를 쓰는 JS Tabs로 대신한다
    '(app)/(tabs)/_layout': {
      default: () => (
        <Tabs screenOptions={{ headerShown: false, lazy: false }}>
          <Tabs.Screen name="(todos)" />
          <Tabs.Screen name="(me)" />
        </Tabs>
      ),
      unstable_settings: tabsSettings,
    },
    '(app)/(tabs)/(todos)/_layout': {
      default: () => <Stack screenOptions={{ animation: 'none' }} />,
      unstable_settings: todosTabSettings,
    },
    '(app)/(tabs)/(me)/_layout': {
      default: () => <Stack screenOptions={{ animation: 'none' }} />,
      unstable_settings: meTabSettings,
    },
    '(app)/(tabs)/(todos)/feed/index': FeedScreen,
    '(app)/(tabs)/(me)/mypage/index': createScreen('mypage'),
    '(app)/todo/[todoId]/index': createScreen('todo'),
    '(app)/todo/[todoId]/actions': createScreen('todo-actions'),
    '(app)/invite-welcome/[friendId]': createScreen('invite-welcome'),
  };
  const route = await renderAppRoute(
    Object.fromEntries(Object.entries(routes).sort(([a], [b]) => (a < b ? -1 : 1))),
    { url, di, withLocalDate: true },
  );

  return {
    route,
    rootStack: () => describeRootStack(route.getRouterState()),
    pendingWidgetCommand: () => di.widgetNavigationRepository.findPendingCommand(),
    signIn: () => act(async () => authSessionStore.setStatus('authenticated')),
    /** Android 위젯 HeadlessJS가 실제로 누른 목적지를 저장한다 */
    tapAndroidWidget: (uri: string) =>
      act(async () => {
        di.widgetNavigationRepository.save({
          id: `tap-${uri}`,
          uri,
          userId: ME.userId,
          createdAt: getNowInstant(),
        });
      }),
  };
}

describe('위젯으로 들어온 흐름', () => {
  beforeEach(() => {
    stubWindowDimensions(390);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue(null);
  });

  afterEach(() => {
    clearColdStartPath();
    jest.restoreAllMocks();
  });

  // 홈 화면에 이미 놓인 위젯이 쓰는 URI다. 외부 계약이라 줄을 지우거나 바꾸지 않는다
  it.each([
    ['aido://feed?date=today', '/feed', {}],
    ['aido://feed?date=2026-11-13', '/feed', { date: '2026-11-13' }],
    ['aido://feed?date=today&action=add-todo', '/feed', { date: 'today', action: 'add-todo' }],
    ['aido-preview://feed?date=today', '/feed', {}],
    ['aido-dev://todo/8', '/todo/8', { todoId: '8' }],
  ] as const)(
    '꺼진 앱을 %s로 열면 인증 뒤 %s에 열고, 아래에 할 일 탭 첫 화면만 깔려 뒤로 가면 피드다',
    async (widgetUri, pathname, params) => {
      // Given
      const { route, rootStack, signIn } = await setup({
        status: 'loading',
        url: toColdStartUrl(widgetUri),
      });

      // When
      await signIn();

      // Then
      await waitFor(() => expect(route.getPathname()).toBe(pathname));
      await waitFor(() => expect(route.getSearchParams()).toEqual(params));
      expect(rootStack()).toHaveLength(1);
      expect(rootStack()[0]).toMatch(/^\(app\)\[\(tabs\)/);

      // When
      await act(() => router.back());

      // Then
      expect(route.getPathname()).toBe('/feed');
      expect(rootStack()).toEqual(['(app)[(tabs)]']);
      expect(router.canGoBack()).toBe(false);
    },
  );

  it('켜 둔 앱에서 할 일 시트가 열린 채 Android 위젯 만들기를 누르면 시트를 닫고 피드에 열어 탭 묶음이 두 겹 쌓이지 않는다', async () => {
    // Given
    const { route, rootStack, tapAndroidWidget } = await setup({
      status: 'authenticated',
      url: '/todo/3/actions',
    });
    expect(rootStack()).toEqual(['(app)[(tabs),todo/[todoId]/actions]']);

    // When
    await tapAndroidWidget('aido://feed?date=today&action=add-todo');

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    expect(feedParams()).toEqual({ date: 'today', action: 'add-todo' });
    expect(rootStack()).toEqual(['(app)[(tabs)]']);
  });

  it('날짜가 붙은 상세 링크로 연 앱에서 오늘 피드로 돌아온 뒤 그 날짜 위젯을 누르면 그 날짜 피드를 연다', async () => {
    // Given
    const { route, tapAndroidWidget } = await setup({
      status: 'authenticated',
      url: '/todo/3?date=2026-11-13',
    });
    await act(() => router.back());
    expect(route.getPathname()).toBe('/feed');
    expect(feedParams()).toEqual({});

    // When
    await tapAndroidWidget('aido://feed?date=2026-11-13');

    // Then
    await waitFor(() => expect(feedParams()).toEqual({ date: '2026-11-13' }));
  });

  it('초대를 받아 친구 id가 상위 route에 남아도 내 피드 칸에 상세를 연 채 누른 오늘 위젯은 이미 보이는 피드라 칸을 닫지 않는다', async () => {
    // Given
    stubWindowDimensions(1024);
    const { route, tapAndroidWidget, pendingWidgetCommand } = await setup({
      status: 'authenticated',
      url: '/feed',
    });
    await act(() => router.push('/invite'));
    await act(() =>
      router.dismissTo(
        { pathname: '/invite-welcome/[friendId]', params: { friendId: INVITER_ID } },
        { withAnchor: true },
      ),
    );
    await act(() => router.back());
    await act(() => router.setParams({ todoId: '8' }));
    expect(route.getPathname()).toBe('/feed');

    // When
    await tapAndroidWidget('aido://feed?date=today');

    // Then
    await waitFor(() => expect(pendingWidgetCommand()).toBeNull());
    expect(feedParams()).toEqual({ todoId: '8' });
  });

  it('켜 둔 앱에서 할 일 상세를 보던 중 Android 위젯 날짜를 누르면 피드로 돌아가 탭 묶음이 두 겹 쌓이지 않는다', async () => {
    // Given
    const { route, rootStack, tapAndroidWidget } = await setup({
      status: 'authenticated',
      url: '/todo/3',
    });

    // When
    await tapAndroidWidget('aido://feed?date=2026-11-13');

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    expect(feedParams()).toEqual({ date: '2026-11-13' });
    expect(rootStack()).toEqual(['(app)[(tabs)]']);
  });
});
