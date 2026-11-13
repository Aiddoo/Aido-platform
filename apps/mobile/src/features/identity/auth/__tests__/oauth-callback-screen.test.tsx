import { AuthGateLayout } from '@src/bootstrap/navigation/auth-gate-layout';
import { ok } from '@src/core/errors/result';
import type { PushNotificationResponse } from '@src/core/ports/push-notification-gateway';
import type { AuthStatus } from '@src/core/session/auth-status';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createMarkReadResponseDto } from '@src/features/notification/__tests__/notification.fixtures';
import { ENV } from '@src/shared/config/env';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createPushNotificationGatewayStub,
  createTestDi,
  stubWindowDimensions,
} from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import * as ExpoLinking from 'expo-linking';
import { Stack, Tabs } from 'expo-router';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { useEffect } from 'react';
import { Linking, Pressable, Text } from 'react-native';

import { unstable_settings as meTabSettings } from '../../../../../app/(app)/(tabs)/(me)/_layout';
import { unstable_settings as todosTabSettings } from '../../../../../app/(app)/(tabs)/(todos)/_layout';
import { unstable_settings as tabsSettings } from '../../../../../app/(app)/(tabs)/_layout';
import OAuthCallbackScreen from '../../../../../app/auth/[provider]';
import RootIndex from '../../../../../app/index';
import { createAuthSessionStoreStub } from './create-auth-session-store-stub';

// renderRouter는 실제 라우터로 URL·이동을 검증하므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

type SystemUrlListener = (event: { url: string }) => void;

// expo-router 시험 도구는 OS 링크 구독을 빈 함수로 막는다. 브라우저가 돌려준 콜백 링크를 켜진 앱에 흘릴 수 있게 구독을 모은다
const systemUrlListeners = new Set<SystemUrlListener>();
Object.assign(jest.requireMock<Record<string, unknown>>('expo-linking'), {
  addEventListener: (_type: 'url', listener: SystemUrlListener) => {
    systemUrlListeners.add(listener);
    return { remove: () => systemUrlListeners.delete(listener) };
  },
});

/** 로그인 전에 누른 할 일 푸시 */
const TODO_PUSH: PushNotificationResponse = {
  id: 'response-todo',
  actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
  data: {
    notificationId: 7,
    type: 'TODO_SHARED',
    action: { type: 'DEEP_LINK' },
    navigation: { kind: 'TODO', todoId: 42 },
  },
};

/** 화면이 새로 마운트됐는지 센다. 같은 화면으로 돌아오면 늘지 않는다 */
const mountedScreens: string[] = [];

function createScreen(testID: string) {
  return function RouteScreen() {
    useEffect(() => {
      mountedScreens.push(testID);
    }, []);
    return <Text testID={testID}>{testID}</Text>;
  };
}

interface StackNode {
  name: string;
  state?: { routes: StackNode[] };
}

/** 루트 Stack에 쌓인 route와 그 바로 안 route 이름 */
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

async function openCallbackLink(provider: string) {
  await act(async () => {
    systemUrlListeners.forEach((listener) =>
      listener({ url: `${ENV.SCHEME}://auth/${provider}?code=one-time-code` }),
    );
  });
}

let mockAuthSessionStore = createAuthSessionStoreStub('loading');

function LoadingScreen() {
  return (
    <Pressable
      testID="boot-authenticated"
      onPress={() => mockAuthSessionStore.setStatus('authenticated')}
    >
      <Text>Restore session</Text>
    </Pressable>
  );
}

async function renderOAuthCallback(status: AuthStatus, url = '/auth/kakao') {
  mockAuthSessionStore = createAuthSessionStoreStub(status);
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async () => ok(createCurrentUserDto()));
  httpClient.patch.mockImplementation(async () => ok(createMarkReadResponseDto()));
  const analytics = createAnalyticsStub();
  const pushNotification = createPushNotificationGatewayStub();
  const di = createTestDi({
    ports: { httpClient, analytics, pushNotification },
    seeds: { authSessionStore: mockAuthSessionStore },
  });

  const routes = {
    _layout: AuthGateLayout,
    index: RootIndex,
    loading: LoadingScreen,
    'auth/[provider]': OAuthCallbackScreen,
    'invite/index': () => <Text>Invite</Text>,
    '(auth)/_layout': () => <Stack screenOptions={{ animation: 'none' }} />,
    '(auth)/login': createScreen('login'),
    '(app)/_layout': {
      default: () => <Stack screenOptions={{ animation: 'none' }} />,
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
    '(app)/(tabs)/(todos)/feed/index': createScreen('feed'),
    '(app)/(tabs)/(me)/mypage/index': createScreen('mypage'),
    '(app)/(tabs)/(me,todos)/settings/linked-accounts': createScreen('linked-accounts'),
    '(app)/todo/[todoId]/index': createScreen('todo'),
  };
  // Metro는 route 파일을 경로 순으로 올리고, 탭이 정해지지 않은 링크가 고르는 그룹이 이 순서를 따른다. 같은 순서로 올린다
  const route = await renderAppRoute(
    Object.fromEntries(Object.entries(routes).sort(([a], [b]) => (a < b ? -1 : 1))),
    { url, di, withLocalDate: true },
  );
  return {
    route,
    socialAuth: di.socialAuth,
    pushNotification,
    screenViews: () => analytics.trackScreenView.mock.calls.map(([name]) => name),
    finishLogin: () => act(async () => mockAuthSessionStore.signIn()),
  };
}

describe('OAuthCallbackScreen', () => {
  beforeEach(() => {
    mountedScreens.length = 0;
    stubWindowDimensions(390);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['loading', 'locked'] as const)(
    '%s 상태에서 열리면 로그인 화면 대신 판정을 기다린다',
    async (status) => {
      // Given·When
      const { route, socialAuth } = await renderOAuthCallback(status);

      // Then
      expect(route.getPathname()).toBe('/loading');
      expect(screen.queryByTestId('login')).toBeNull();
      expect(socialAuth.completeOAuthSession).toHaveBeenCalled();
    },
  );

  it('판정을 기다리다 세션이 복원되면 피드로 간다', async () => {
    // Given
    const { route } = await renderOAuthCallback('loading');

    // When
    await fireEvent.press(screen.getByTestId('boot-authenticated'));

    // Then
    expect(route.getPathname()).toBe('/feed');
  });

  it.each([
    ['authenticated', '/feed'],
    ['unauthenticated', '/login'],
  ] as const)('%s 상태에서 열리면 %s로 간다', async (status, pathname) => {
    // Given·When
    const { route } = await renderOAuthCallback(status);

    // Then
    expect(route.getPathname()).toBe(pathname);
  });

  it('로그인 화면에서 연 소셜 로그인이 돌아오면 콜백 화면을 닫아 로그인 화면이 두 겹 쌓이지 않는다', async () => {
    // Given
    const { route, socialAuth } = await renderOAuthCallback('unauthenticated', '/login');

    // When
    await openCallbackLink('kakao');

    // Then
    expect(socialAuth.completeOAuthSession).toHaveBeenCalled();
    expect(route.getPathname()).toBe('/login');
    expect(describeRootStack(route.getRouterState())).toEqual(['(auth)[login]']);
    expect(mountedScreens).toEqual(['login']);
  });

  it('콜백을 닫고 소셜 로그인을 마치면 로그인 화면과 피드를 한 번씩만 센다', async () => {
    // Given
    const { route, screenViews, finishLogin } = await renderOAuthCallback(
      'unauthenticated',
      '/login',
    );
    await openCallbackLink('kakao');

    // When
    await finishLogin();

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    expect(screenViews()).toEqual(['/login', '/feed']);
  });

  it('계정 연결에서 돌아오면 피드로 가지 않고 같은 계정 연결 화면으로 돌아온다', async () => {
    // Given
    const { route, socialAuth } = await renderOAuthCallback(
      'authenticated',
      '/settings/linked-accounts',
    );

    // When
    await openCallbackLink('google');

    // Then
    expect(socialAuth.completeOAuthSession).toHaveBeenCalled();
    expect(route.getPathname()).toBe('/settings/linked-accounts');
    expect(describeRootStack(route.getRouterState())).toEqual(['(app)[(tabs)]']);
    expect(mountedScreens.filter((name) => name === 'linked-accounts')).toHaveLength(1);
  });

  it('로그인 전에 누른 푸시는 Android 소셜 로그인을 마친 뒤 피드를 거치지 않고 그 화면에 열린다', async () => {
    // Given
    const { route, pushNotification, screenViews, finishLogin } = await renderOAuthCallback(
      'unauthenticated',
      '/login',
    );
    await act(async () => pushNotification.emitResponse(TODO_PUSH));
    await openCallbackLink('kakao');
    expect(route.getPathname()).toBe('/login');

    // When
    await finishLogin();

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
    expect(screenViews()).not.toContain('/feed');
    expect(describeRootStack(route.getRouterState())).toEqual([
      '(app)[(tabs),todo/[todoId]/index]',
    ]);
  });

  it('로그인을 마친 뒤 늦게 도착한 콜백 링크도 닫히기만 해 로그인 전에 누른 푸시 화면에 머문다', async () => {
    // Given
    const { route, pushNotification, screenViews, finishLogin } = await renderOAuthCallback(
      'unauthenticated',
      '/login',
    );
    await act(async () => pushNotification.emitResponse(TODO_PUSH));
    await finishLogin();
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));

    // When
    await openCallbackLink('google');

    // Then
    expect(route.getPathname()).toBe('/todo/42');
    expect(screenViews()).not.toContain('/feed');
    expect(describeRootStack(route.getRouterState())).toEqual([
      '(app)[(tabs),todo/[todoId]/index]',
    ]);
  });
});
