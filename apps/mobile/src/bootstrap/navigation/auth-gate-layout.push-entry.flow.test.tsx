import type { NotificationNavigation, NotificationNavigationKind } from '@aido/api';
import { ErrorCode, HttpStatus } from '@aido/api/errors';
import { err, ok, type Result } from '@src/core/errors/result';
import type { PushNotificationResponse } from '@src/core/ports/push-notification-gateway';
import type { AuthStatus } from '@src/core/session/auth-status';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createMarkReadResponseDto } from '@src/features/notification/__tests__/notification.fixtures';
import { NOTIFICATION_READ_BUDGET_MS } from '@src/features/notification/constants/notification.constants';
import { ApiError, NetworkError } from '@src/shared/errors';
import {
  createAppLifecycleGatewayStub,
  createExternalLinkGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createPushNotificationGatewayStub,
  createTestDi,
  stubWindowDimensions,
} from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import { userEvent } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import * as ExpoLinking from 'expo-linking';
import { router, Stack, Tabs, useFocusEffect } from 'expo-router';
import { act, screen, waitFor } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';
import { type ComponentType, useCallback } from 'react';
import { Linking, Pressable, Text } from 'react-native';
import { match } from 'ts-pattern';

import { unstable_settings as myPageTabSettings } from '../../../app/(app)/(tabs)/(me)/_layout';
import { unstable_settings as memoTabSettings } from '../../../app/(app)/(tabs)/(memos)/_layout';
import { unstable_settings as feedTabSettings } from '../../../app/(app)/(tabs)/(todos)/_layout';
import { unstable_settings as tabsSettings } from '../../../app/(app)/(tabs)/_layout';
import { unstable_settings as appSettings } from '../../../app/(app)/_layout';
import TodoDetailRoute from '../../../app/(app)/todo/[todoId]/index';
import RootIndex from '../../../app/index';
import { AuthGateLayout } from './auth-gate-layout';

// renderRouter는 실제 라우터로 URL·이동을 검증하므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

const TODO_RESPONSE: PushNotificationResponse = {
  id: 'response-1',
  actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
  data: {
    notificationId: 7,
    type: 'TODO_SHARED',
    action: { type: 'DEEP_LINK' },
    navigation: { kind: 'TODO', todoId: 42 },
  },
};

const SECOND_TODO_RESPONSE: PushNotificationResponse = {
  id: 'response-2',
  actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
  data: {
    notificationId: 8,
    type: 'TODO_SHARED',
    action: { type: 'DEEP_LINK' },
    navigation: { kind: 'TODO', todoId: 43 },
  },
};

const READ_OK = ok(createMarkReadResponseDto());

/** 세 탭이 함께 쓰는 화면 중 알림이 여는 것 */
const SHARED_TAB_SCREENS = [
  'friends/index',
  'friends/invite/index',
  'achievements/index',
  'reports/index',
  'settings/subscription',
  'settings/notifications/index',
  'notifications/index',
] as const;

const PAGINATION = {
  previousCursor: null,
  nextCursor: null,
  hasPrevious: false,
  hasNext: false,
  size: 30,
};

type TabGroup = '(todos)' | '(memos)' | '(me)';

/** 알림을 연 뒤의 자리 */
interface Landing {
  pathname: string;
  /** 연 화면이 있는 탭. 탭 위 화면(할 일 상세·알림함·날씨)이면 null */
  tab: TabGroup | null;
  /** 뒤로 가면 나오는 경로. 탭 첫 화면이라 돌아갈 곳이 없으면 null */
  back: string | null;
}

/** 할 일 탭 첫 화면. 이동이 없거나 외부 링크인 알림도 콜드 스타트는 여기서 시작한다 */
const FEED_ROOT: Landing = { pathname: '/feed', tab: '(todos)', back: null };

/** 탭 위 화면은 아래에 보던 탭(콜드는 할 일 탭)이 깔린다 */
function aboveTabs(pathname: string): { cold: Landing; warm: Landing } {
  const landing = { pathname, tab: null, back: '/feed' };
  return { cold: landing, warm: landing };
}

/** 세 탭이 함께 쓰는 화면. 콜드는 마이 탭에 열려 아래에 내 정보 메뉴가 깔리고, 웜은 보던 탭(할 일) 위에 쌓인다 */
function sharedScreen(pathname: string): { cold: Landing; warm: Landing } {
  return {
    cold: { pathname, tab: '(me)', back: '/mypage' },
    warm: { pathname, tab: '(todos)', back: '/feed' },
  };
}

const FEED_TAB_ROOT = { cold: FEED_ROOT, warm: FEED_ROOT };

/** 켜 둔 앱에서 보던 곳(탭 첫 화면, 그 탭, 위에 띄운 탭 밖 시트 route) */
const WARM_STARTS = [
  ['/feed', '(todos)', null],
  ['/feed', '(todos)', '/todo/new'],
  ['/memo', '(memos)', null],
  ['/memo', '(memos)', '/todo/new'],
  ['/mypage', '(me)', null],
  ['/mypage', '(me)', '/todo/new'],
] as const;
const FRIEND_ID = 'cmfriend00000000000000001';

/**
 * 서버 navigation kind마다 콜드(꺼진 앱)·웜(뒤에 있던 앱, 할 일 탭 첫 화면을 보던 중)에서 열리는 자리.
 * 서버가 kind를 더하면 이 표가 타입 검사에서 먼저 깨진다
 */
const LANDINGS = {
  NONE: { navigation: { kind: 'NONE' }, ...FEED_TAB_ROOT },
  EXTERNAL_URL: {
    navigation: { kind: 'EXTERNAL_URL', url: 'https://aido.kr/notice', presentation: 'BROWSER' },
    ...FEED_TAB_ROOT,
  },
  FEED: { navigation: { kind: 'FEED' }, ...FEED_TAB_ROOT },
  FRIEND_FEED: { navigation: { kind: 'FRIEND_FEED', friendId: FRIEND_ID }, ...FEED_TAB_ROOT },
  CHEER: { navigation: { kind: 'CHEER', cheerId: 3, friendId: FRIEND_ID }, ...FEED_TAB_ROOT },
  FRIENDS: { navigation: { kind: 'FRIENDS' }, ...sharedScreen('/friends') },
  FRIEND_REQUESTS: { navigation: { kind: 'FRIEND_REQUESTS' }, ...sharedScreen('/friends') },
  TODO: { navigation: { kind: 'TODO', todoId: 42 }, ...aboveTabs('/todo/42') },
  TODO_COMMENT: {
    navigation: {
      kind: 'TODO_COMMENT',
      todoId: 42,
      commentId: 'cmt92zn3n000b7voxx9quc2th',
      threadCommentId: 'cmt92zn3n000b7voxx9quc2th',
      activityKind: 'COMMENT',
    },
    ...aboveTabs('/todo/42'),
  },
  NUDGE: { navigation: { kind: 'NUDGE', nudgeId: 7 }, ...aboveTabs('/nudges/7') },
  WEATHER: { navigation: { kind: 'WEATHER' }, ...aboveTabs('/weather') },
  WEATHER_RESCHEDULE: {
    navigation: { kind: 'WEATHER_RESCHEDULE', todoIds: [12, 15], reason: 'rain' },
    ...aboveTabs('/weather/reschedule'),
  },
  ACHIEVEMENTS: { navigation: { kind: 'ACHIEVEMENTS' }, ...sharedScreen('/achievements') },
  REPORTS: { navigation: { kind: 'REPORTS' }, ...sharedScreen('/reports') },
  SUGGESTIONS: { navigation: { kind: 'SUGGESTIONS' }, ...aboveTabs('/suggestions') },
  INVITE: { navigation: { kind: 'INVITE' }, ...sharedScreen('/friends/invite') },
  SUBSCRIPTION: { navigation: { kind: 'SUBSCRIPTION' }, ...sharedScreen('/settings/subscription') },
  NOTIFICATIONS: { navigation: { kind: 'NOTIFICATIONS' }, ...sharedScreen('/notifications') },
  NOTIFICATION_SETTINGS: {
    navigation: { kind: 'NOTIFICATION_SETTINGS' },
    ...sharedScreen('/settings/notifications'),
  },
} satisfies {
  [Kind in NotificationNavigationKind]: {
    navigation: Extract<NotificationNavigation, { kind: Kind }>;
    cold: Landing;
    warm: Landing;
  };
};

const LANDING_CASES = Object.values(LANDINGS).map(({ navigation, cold, warm }) => ({
  kind: navigation.kind,
  navigation,
  cold,
  warm,
}));

function createResponse(navigation: NotificationNavigation): PushNotificationResponse {
  return {
    id: `response-${navigation.kind}`,
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    data: { notificationId: 7, type: 'TODO_SHARED', action: { type: 'DEEP_LINK' }, navigation },
  };
}

interface RouteState {
  routes: { name: string; state?: RouteState }[];
}

/** 탭 위 Stack(`(app)`)에 쌓인 탭 묶음 수. 하나여야 탭 바가 두 겹이 되지 않는다 */
function countTabGroups(state: RouteState | undefined): number {
  const appStack = state?.routes
    .find(({ name }) => name === '__root')
    ?.state?.routes.find(({ name }) => name === '(app)')?.state;
  return appStack?.routes.filter(({ name }) => name === '(tabs)').length ?? 0;
}

/** 지금 화면이 있는 탭. 탭 위 화면이면 null */
function findTab(segments: string[]): string | null {
  return segments[1] === '(tabs)' ? (segments[2] ?? null) : null;
}

/** 뒤로 가기 한 번 뒤의 경로. 돌아갈 곳이 없으면 null이다 */
async function goBack(route: { getPathname(): string }): Promise<string | null> {
  if (!router.canGoBack()) {
    return null;
  }
  await act(() => router.back());
  return route.getPathname();
}

interface SetupOptions {
  status: AuthStatus;
  initialUrl?: string;
  lastResponse?: PushNotificationResponse;
  markRead?: () => Promise<Result<unknown, ApiError>>;
  /** 할 일 상세 자리에 그릴 화면. 비우면 focus만 남기는 빈 화면이다 */
  todoScreen?: ComponentType;
}

function createScreen(testID: string) {
  return function RouteScreen() {
    return <Text testID={testID}>{testID}</Text>;
  };
}

function createStackLayout(unstableSettings: { anchor: string }) {
  return {
    default: () => <Stack screenOptions={{ headerShown: false, animation: 'none' }} />,
    unstable_settings: unstableSettings,
  };
}

async function setup({
  status,
  initialUrl = '/',
  lastResponse,
  markRead,
  todoScreen,
}: SetupOptions) {
  const gateway = createPushNotificationGatewayStub();
  gateway.setLastResponse(lastResponse ?? null);
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async (url: string) =>
    url === 'v1/auth/me' ? ok(createCurrentUserDto()) : ok({ unreadCount: 0 }),
  );
  httpClient.patch.mockImplementation(markRead ?? (async () => READ_OK));
  httpClient.post.mockImplementation(async () => ok({ opened: true }));
  const authSessionStore = createAuthSessionStoreStub(status);
  const focusLog: string[] = [];
  const hideLog: string[] = [];

  function LoadingScreen() {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="boot-authenticated"
        onPress={() => authSessionStore.setStatus('authenticated')}
      >
        <Text>Restore session</Text>
      </Pressable>
    );
  }

  function LoginScreen() {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="login"
        onPress={() => authSessionStore.setStatus('authenticated')}
      >
        <Text>Login</Text>
      </Pressable>
    );
  }

  function FeedScreen() {
    useFocusEffect(
      useCallback(() => {
        focusLog.push('feed');
      }, []),
    );
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="logout"
        onPress={() => authSessionStore.setStatus('unauthenticated')}
      >
        <Text>Feed</Text>
      </Pressable>
    );
  }

  function TodoScreen() {
    useFocusEffect(
      useCallback(() => {
        focusLog.push('todo');
      }, []),
    );
    return <Text testID="todo-detail">Todo details</Text>;
  }

  const externalLink = createExternalLinkGatewayStub();
  const appLifecycle = createAppLifecycleGatewayStub();
  const di = createTestDi({
    ports: { externalLink, appLifecycle, httpClient, pushNotification: gateway },
    seeds: { authSessionStore },
  });

  // 앱과 같은 탭 모양: 탭 위 Stack, 탭마다 Stack과 anchor, 세 탭이 함께 쓰는 화면(app/(app)/(tabs))
  const routes = {
    _layout: AuthGateLayout,
    index: RootIndex,
    loading: LoadingScreen,
    'invite/index': () => <Text>Invite</Text>,
    '(auth)/_layout': () => <Stack screenOptions={{ animation: 'none' }} />,
    '(auth)/login': LoginScreen,
    '(app)/_layout': createStackLayout(appSettings),
    // NativeTabs는 Jest에서 그려지지 않아 같은 탭 라우터를 쓰는 JS Tabs로 대신한다
    '(app)/(tabs)/_layout': {
      default: () => (
        <Tabs screenOptions={{ headerShown: false, lazy: false }}>
          <Tabs.Screen name="(todos)" />
          <Tabs.Screen name="(memos)" />
          <Tabs.Screen name="(me)" />
        </Tabs>
      ),
      unstable_settings: tabsSettings,
    },
    '(app)/(tabs)/(todos)/_layout': createStackLayout(feedTabSettings),
    '(app)/(tabs)/(memos)/_layout': createStackLayout(memoTabSettings),
    '(app)/(tabs)/(me)/_layout': createStackLayout(myPageTabSettings),
    '(app)/(tabs)/(todos)/feed/index': FeedScreen,
    '(app)/(tabs)/(memos)/memo/index': createScreen('memo'),
    '(app)/(tabs)/(me)/mypage/index': createScreen('mypage'),
    ...Object.fromEntries(
      SHARED_TAB_SCREENS.map((name) => [
        `(app)/(tabs)/(me,memos,todos)/${name}`,
        createScreen(name),
      ]),
    ),
    '(app)/nudges/[nudgeId]': createScreen('nudge'),
    '(app)/suggestions/index': createScreen('suggestions'),
    '(app)/todo/new': createScreen('todo-new'),
    '(app)/todo/[todoId]/index': todoScreen ?? TodoScreen,
    '(app)/weather/_layout': () => (
      <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
    ),
    '(app)/weather/index': createScreen('weather'),
    '(app)/weather/reschedule': createScreen('weather-reschedule'),
  };
  // Metro는 route 파일을 경로 순으로 올리고, 탭이 정해지지 않은 이동이 고르는 그룹이 이 순서를 따른다
  const route = await renderAppRoute(
    Object.fromEntries(Object.entries(routes).sort(([a], [b]) => (a < b ? -1 : 1))),
    { url: initialUrl, di, withLocalDate: true, withOverlay: todoScreen != null },
  );

  jest.mocked(SplashScreen.hideAsync).mockImplementation(async () => {
    hideLog.push(route.getPathname());
  });

  return {
    route,
    gateway,
    httpClient,
    focusLog,
    hideLog,
    externalLink,
    appLifecycle,
    analytics: di.analytics,
  };
}

describe('푸시 탭 진입', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubWindowDimensions(390);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('앱 종료 상태 탭: 스플래시 뒤에서 목적지로 바로 가 피드가 focus되지 않는다', async () => {
    // Given
    const user = userEvent.setup();
    const read = createPendingResponse(READ_OK);
    const { route, gateway, focusLog, hideLog, analytics } = await setup({
      status: 'loading',
      lastResponse: TODO_RESPONSE,
      markRead: () => read.response,
    });
    expect(route.getPathname()).toBe('/loading');

    // When
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

    // Then
    await waitFor(() => expect(gateway.clearLastResponse).not.toHaveBeenCalled());
    expect(route.getPathname()).toBe('/loading');
    expect(hideLog).toEqual([]);

    // When
    await act(async () => read.settle());

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
    await waitFor(() => expect(hideLog).toEqual(['/todo/42']));
    expect(focusLog).toEqual(['todo']);
    await waitFor(() => expect(gateway.clearLastResponse).toHaveBeenCalled());
    expect(analytics.trackEvent).toHaveBeenCalledWith(
      'push_notification_opened',
      expect.objectContaining({ app_state: 'cold' }),
    );
  });

  it('뒤에 있던 앱의 탭: 한 번만 이동하고 열림을 background로 한 번 남긴다', async () => {
    // Given
    const { route, gateway, appLifecycle, analytics } = await setup({ status: 'authenticated' });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    await act(async () => appLifecycle.emit('background'));

    // When
    await act(async () => gateway.emitResponse(TODO_RESPONSE));
    await act(async () => appLifecycle.emit('active'));
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'push_notification_opened',
        expect.objectContaining({ app_state: 'background' }),
      ),
    );
    expect(
      jest
        .mocked(analytics.trackEvent)
        .mock.calls.filter(([eventName]) => eventName === 'push_notification_opened'),
    ).toHaveLength(1);
  });

  it('앱 종료 상태 탭: 다른 계정 알림은 버리고 피드로 간다', async () => {
    // Given
    const user = userEvent.setup();
    const { route, gateway, focusLog } = await setup({
      status: 'loading',
      lastResponse: TODO_RESPONSE,
      markRead: async () => err(new ApiError('NOTIFICATION_1004', '없어요', 404)),
    });

    // When
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    expect(focusLog).toEqual(['feed']);
    expect(gateway.getLastResponse()).toBeNull();
  });

  it('앱 종료 상태 탭: 오프라인이어도 목적지로 간다', async () => {
    // Given
    const user = userEvent.setup();
    const { route } = await setup({
      status: 'loading',
      lastResponse: TODO_RESPONSE,
      markRead: async () => {
        throw new NetworkError();
      },
    });

    // When
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
  });

  it('앱 종료 상태 탭: 이동 없는 알림은 피드로 간다', async () => {
    // Given
    const user = userEvent.setup();
    const { route, focusLog, gateway } = await setup({
      status: 'loading',
      lastResponse: {
        ...TODO_RESPONSE,
        data: {
          notificationId: 0,
          type: 'SYSTEM_NOTICE',
          action: { type: 'NONE' },
          navigation: { kind: 'NONE' },
        },
      },
    });

    // When
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    expect(focusLog).toEqual(['feed']);
    await waitFor(() => expect(gateway.getLastResponse()).toBeNull());
  });

  it('앱 종료 상태 탭: 외부 링크는 피드로 간 뒤 한 번만 연다', async () => {
    // Given
    const user = userEvent.setup();
    const { route, externalLink } = await setup({
      status: 'loading',
      lastResponse: {
        ...TODO_RESPONSE,
        data: {
          notificationId: 0,
          type: 'SYSTEM_NOTICE',
          action: { type: 'BROWSER', url: 'https://aido.kr/notice' },
          navigation: {
            kind: 'EXTERNAL_URL',
            url: 'https://aido.kr/notice',
            presentation: 'BROWSER',
          },
        },
      },
    });

    // When
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    await waitFor(() => expect(externalLink.open).toHaveBeenCalledTimes(1));
    expect(externalLink.open).toHaveBeenCalledWith('https://aido.kr/notice');
  });

  it('앱 종료 상태 탭: 펼친 화면은 피드의 상세 pane으로 연다', async () => {
    // Given
    const user = userEvent.setup();
    stubWindowDimensions(1000);
    const { route, hideLog } = await setup({ status: 'loading', lastResponse: TODO_RESPONSE });

    // When
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

    // Then
    await waitFor(() => expect(hideLog).toEqual(['/feed']));
    expect(route.getSearchParams()).toMatchObject({ todoId: '42' });
  });

  it('공개 화면에서 탭: 인증된 사용자는 Index를 거치지 않고 바로 이동한다', async () => {
    // Given
    const { route, gateway } = await setup({ status: 'authenticated', initialUrl: '/invite' });
    await waitFor(() => expect(route.getPathname()).toBe('/invite'));

    // When
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
  });

  it('앱 종료 상태 탭: 뒤로 가면 피드이고 다시 이동하지 않는다', async () => {
    // Given
    const user = userEvent.setup();
    const { route, gateway } = await setup({ status: 'loading', lastResponse: TODO_RESPONSE });
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));

    // When
    await act(() => router.back());

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    expect(gateway.getLastResponse()).toBeNull();

    // When
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // Then
    expect(route.getPathname()).toBe('/feed');
  });

  it('잠금 중 콜드 스타트: 스피너로 넘겼다가 잠금이 풀리면 이동한다', async () => {
    // Given
    const user = userEvent.setup();
    const { route } = await setup({ status: 'locked', lastResponse: TODO_RESPONSE });
    await waitFor(() => expect(route.getPathname()).toBe('/loading'));
    await waitFor(() => expect(SplashScreen.hideAsync).toHaveBeenCalled());

    // When
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
  });

  it('포그라운드 탭: 읽음 응답 뒤 피드 위로 이동한다', async () => {
    // Given
    const read = createPendingResponse(READ_OK);
    const { route, gateway } = await setup({
      status: 'authenticated',
      markRead: () => read.response,
    });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));

    // When
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // Then
    expect(route.getPathname()).toBe('/feed');

    // When
    await act(async () => read.settle());

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
  });

  it('로그아웃 상태 탭: 보관했다가 로그인 뒤 한 번만 이동한다', async () => {
    // Given
    const user = userEvent.setup();
    const { route, gateway, httpClient } = await setup({ status: 'unauthenticated' });
    await waitFor(() => expect(route.getPathname()).toBe('/login'));
    await act(async () => gateway.emitResponse(TODO_RESPONSE));
    expect(httpClient.patch).not.toHaveBeenCalled();

    // When
    await user.press(screen.getByRole('button', { name: 'login' }));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
    expect(httpClient.patch).toHaveBeenCalledTimes(1);

    // When
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // Then
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
  });

  it('다른 계정 알림: 읽음이 없는 알림(NOTIFICATION_1004)이면 버리고 피드에 머문다', async () => {
    // Given
    const { route, gateway } = await setup({
      status: 'authenticated',
      markRead: async () => err(new ApiError('NOTIFICATION_1004', '없어요', 404)),
    });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));

    // When
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // Then
    await waitFor(() => expect(gateway.clearLastResponse).toHaveBeenCalled());
    expect(route.getPathname()).toBe('/feed');
  });

  it('오프라인: 읽음을 확인하지 못해도 바로 이동하고 opened를 기록한다', async () => {
    // Given
    const { route, gateway, httpClient } = await setup({
      status: 'authenticated',
      markRead: async () => {
        throw new NetworkError();
      },
    });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));

    // When
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledWith('v1/notifications/7/opened'));
    expect(gateway.getLastResponse()).toBeNull();
  });

  it('서버가 답이 없어도 읽음 예산이 지나면 이동한다', async () => {
    // Given
    const { route, gateway } = await setup({
      status: 'authenticated',
      markRead: () => new Promise(noop),
    });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));

    // When
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // Then
    expect(route.getPathname()).toBe('/feed');
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'), {
      timeout: NOTIFICATION_READ_BUDGET_MS + 1000,
    });
  });

  it('로그아웃하면 진행 중인 읽음이 끝나도 이동하지 않고 마지막 응답을 지운다', async () => {
    // Given
    const user = userEvent.setup();
    const read = createPendingResponse(READ_OK);
    const { route, gateway } = await setup({
      status: 'authenticated',
      markRead: () => read.response,
    });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // When
    await user.press(screen.getByRole('button', { name: 'logout' }));
    await waitFor(() => expect(route.getPathname()).toBe('/login'));
    await act(async () => read.settle());

    // Then
    expect(route.getPathname()).toBe('/login');
    expect(gateway.getLastResponse()).toBeNull();
  });

  it('연속 두 탭: 마지막 탭만 열고 뒤로 가면 피드다', async () => {
    // Given
    const user = userEvent.setup();
    const { route, gateway } = await setup({ status: 'loading' });
    await act(async () => gateway.emitResponse(TODO_RESPONSE));
    await act(async () => gateway.emitResponse(SECOND_TODO_RESPONSE));

    // When
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/43'));
    await act(() => router.back());
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
  });

  it('포그라운드에서 연속 두 탭: 앞 탭의 읽음 응답이 늦어도 마지막 탭만 연다', async () => {
    // Given
    const firstRead = createPendingResponse(READ_OK);
    const { route, gateway, httpClient, analytics } = await setup({ status: 'authenticated' });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    httpClient.patch.mockImplementationOnce(() => firstRead.response);
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // When
    await act(async () => gateway.emitResponse(SECOND_TODO_RESPONSE));
    await waitFor(() => expect(route.getPathname()).toBe('/todo/43'));
    await act(async () => firstRead.settle());

    // Then
    expect(route.getPathname()).toBe('/todo/43');
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
  });

  it('모르는 타입: navigation이 없으면 알림 목록으로 간다', async () => {
    // Given
    const { route, gateway, analytics } = await setup({ status: 'authenticated' });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));

    // When
    await act(async () =>
      gateway.emitResponse({
        ...TODO_RESPONSE,
        data: { notificationId: 7, type: 'NEW_KIND', action: { type: 'DEEP_LINK' } },
      }),
    );

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/notifications'));
    expect(analytics.trackEvent).toHaveBeenCalledWith(
      'push_notification_opened',
      expect.objectContaining({ type: 'UNKNOWN', action: 'DEEP_LINK' }),
    );
  });

  it('모르는 타입: navigation이 있으면 그 목적지로 간다', async () => {
    // Given
    const { route, gateway } = await setup({ status: 'authenticated' });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));

    // When
    await act(async () =>
      gateway.emitResponse({
        ...TODO_RESPONSE,
        data: {
          notificationId: 7,
          type: 'NEW_KIND',
          action: { type: 'DEEP_LINK' },
          navigation: { kind: 'TODO', todoId: 42 },
        },
      }),
    );

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
  });

  it('수신 거부 버튼: 실패하면 다음 탭에 밀리지 않고 포그라운드로 돌아올 때 다시 보낸다', async () => {
    // Given
    const { route, gateway, httpClient, appLifecycle } = await setup({ status: 'authenticated' });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    httpClient.post.mockRejectedValueOnce(new NetworkError());
    httpClient.post.mockResolvedValue(
      ok({ optedOut: true, marketingPushWithdrawnAt: '2026-11-09T03:00:00.000Z' }),
    );

    // When
    await act(async () =>
      gateway.emitResponse({
        ...TODO_RESPONSE,
        id: 'opt-out',
        actionIdentifier: 'MARKETING_OPT_OUT',
        data: { ...TODO_RESPONSE.data, marketingOptOutToken: 'token-1' },
      }),
    );
    await act(async () => gateway.emitResponse(SECOND_TODO_RESPONSE));
    await waitFor(() => expect(route.getPathname()).toBe('/todo/43'));
    await act(async () => appLifecycle.emit('active'));

    // Then
    await waitFor(() =>
      expect(
        httpClient.post.mock.calls.filter(
          ([url]) => url === 'v1/notifications/marketing-push/opt-out',
        ),
      ).toHaveLength(2),
    );
  });

  it('수신 거부 버튼: 로그인 없이 처리하고 이동하지 않는다', async () => {
    // Given
    const { route, gateway, httpClient } = await setup({ status: 'unauthenticated' });
    await waitFor(() => expect(route.getPathname()).toBe('/login'));
    httpClient.post.mockResolvedValue(
      ok({ optedOut: true, marketingPushWithdrawnAt: '2026-11-09T03:00:00.000Z' }),
    );

    // When
    await act(async () =>
      gateway.emitResponse({
        ...TODO_RESPONSE,
        actionIdentifier: 'MARKETING_OPT_OUT',
        data: { ...TODO_RESPONSE.data, marketingOptOutToken: 'token-1' },
      }),
    );

    // Then
    await waitFor(() =>
      expect(httpClient.post).toHaveBeenCalledWith('v1/notifications/marketing-push/opt-out', {
        token: 'token-1',
      }),
    );
    expect(
      await screen.findAllByText('2026년 11월 9일에 아이두 광고성 앱 푸시 수신 동의를 철회했어요'),
    ).not.toHaveLength(0);
    expect(route.getPathname()).toBe('/login');
    expect(httpClient.patch).not.toHaveBeenCalled();
    await waitFor(() => expect(gateway.clearLastResponse).toHaveBeenCalled());
  });

  describe('알림 종류마다 열리는 자리(접힌 화면)', () => {
    it.each(LANDING_CASES)(
      '$kind: 꺼진 앱에서 누르면 화면을 가진 탭에 열고 읽음·열림을 한 번 남긴다',
      async ({ navigation, cold }) => {
        // Given
        const user = userEvent.setup();
        const { route, httpClient, analytics } = await setup({
          status: 'loading',
          lastResponse: createResponse(navigation),
        });

        // When
        await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

        // Then
        await waitFor(() =>
          expect(analytics.trackEvent).toHaveBeenCalledWith(
            'push_notification_opened',
            expect.objectContaining({ app_state: 'cold' }),
          ),
        );
        await waitFor(() => expect(route.getPathname()).toBe(cold.pathname));
        expect(findTab(route.getSegments())).toBe(cold.tab);
        expect(httpClient.patch.mock.calls).toEqual([['v1/notifications/7/read']]);
        await waitFor(() =>
          expect(httpClient.post.mock.calls).toEqual([['v1/notifications/7/opened']]),
        );

        // When
        const back = await goBack(route);

        // Then
        expect(back).toBe(cold.back);
      },
    );

    it.each(LANDING_CASES)(
      '$kind: 뒤에 있던 앱에서 누르면 보던 탭 기준으로 열고 읽음·열림을 한 번 남긴다',
      async ({ navigation, warm }) => {
        // Given
        const { route, httpClient, analytics, gateway, appLifecycle } = await setup({
          status: 'authenticated',
        });
        await waitFor(() => expect(route.getPathname()).toBe('/feed'));
        await act(async () => appLifecycle.emit('background'));

        // When
        await act(async () => gateway.emitResponse(createResponse(navigation)));

        // Then
        await waitFor(() =>
          expect(analytics.trackEvent).toHaveBeenCalledWith(
            'push_notification_opened',
            expect.objectContaining({ app_state: 'background' }),
          ),
        );
        await waitFor(() => expect(route.getPathname()).toBe(warm.pathname));
        expect(findTab(route.getSegments())).toBe(warm.tab);
        expect(countTabGroups(route.getRouterState())).toBe(1);
        expect(httpClient.patch.mock.calls).toEqual([['v1/notifications/7/read']]);
        await waitFor(() =>
          expect(httpClient.post.mock.calls).toEqual([['v1/notifications/7/opened']]),
        );

        // When
        const back = await goBack(route);

        // Then
        expect(back).toBe(warm.back);
      },
    );
  });

  describe('할 일 상세(탭 위 화면)를 보던 중 누른 알림', () => {
    it.each([
      { kind: 'FEED', expected: FEED_ROOT },
      {
        kind: 'FRIEND_REQUESTS',
        expected: { pathname: '/friends', tab: '(todos)', back: '/feed' },
      },
      {
        kind: 'NOTIFICATIONS',
        expected: { pathname: '/notifications', tab: '(todos)', back: '/feed' },
      },
      { kind: 'TODO', expected: { pathname: '/todo/42', tab: null, back: '/todo/7' } },
    ] as const)(
      '$kind: 탭 묶음을 두 겹 쌓지 않고 열고 뒤로 가면 $expected.back',
      async ({ kind, expected }) => {
        // Given
        const { route, gateway, analytics } = await setup({ status: 'authenticated' });
        await waitFor(() => expect(route.getPathname()).toBe('/feed'));
        await act(() => router.push('/todo/7'));

        // When
        await act(async () => gateway.emitResponse(createResponse(LANDINGS[kind].navigation)));

        // Then
        await waitFor(() =>
          expect(analytics.trackEvent).toHaveBeenCalledWith(
            'push_notification_opened',
            expect.anything(),
          ),
        );
        await waitFor(() => expect(route.getPathname()).toBe(expected.pathname));
        expect(findTab(route.getSegments())).toBe(expected.tab);
        expect(countTabGroups(route.getRouterState())).toBe(1);

        // When
        const back = await goBack(route);

        // Then
        expect(back).toBe(expected.back);
      },
    );
  });

  describe('보던 탭에서 시트를 연 채 누른 알림', () => {
    it.each(WARM_STARTS)(
      '%s 탭(%s, 시트 %s)에서 누른 함께 쓰는 화면 알림은 그 탭에 열고 뒤로 가면 탭 첫 화면이다',
      async (startUrl, tab, sheetUrl) => {
        // Given
        const { route, gateway, analytics } = await setup({
          status: 'authenticated',
          initialUrl: startUrl,
        });
        await waitFor(() => expect(route.getPathname()).toBe(startUrl));
        if (sheetUrl != null) {
          await act(() => router.push(sheetUrl));
        }

        // When
        await act(async () =>
          gateway.emitResponse(createResponse(LANDINGS.FRIEND_REQUESTS.navigation)),
        );

        // Then
        await waitFor(() =>
          expect(analytics.trackEvent).toHaveBeenCalledWith(
            'push_notification_opened',
            expect.anything(),
          ),
        );
        await waitFor(() => expect(route.getPathname()).toBe('/friends'));
        expect(findTab(route.getSegments())).toBe(tab);
        expect(countTabGroups(route.getRouterState())).toBe(1);

        // When
        const back = await goBack(route);

        // Then
        expect(back).toBe(startUrl);
      },
    );
  });

  it('앱 종료 상태 탭: 지워진 할 일이면 상세에 볼 수 없다는 안내를 보이고 뒤로 가면 할 일 탭이다', async () => {
    // Given
    const user = userEvent.setup();
    const { route, httpClient } = await setup({
      status: 'loading',
      lastResponse: TODO_RESPONSE,
      todoScreen: TodoDetailRoute,
    });
    httpClient.get.mockImplementation(async (url: string) =>
      match(url)
        .with('v1/auth/me', () => ok(createCurrentUserDto()))
        .with('v1/todos/42/details', () =>
          err(new ApiError(ErrorCode.TODO_0801, '없음', HttpStatus.NOT_FOUND)),
        )
        .otherwise(() => ok({ unreadCount: 0, items: [], pagination: PAGINATION, anchor: null })),
    );

    // When
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
    expect(await screen.findByText('지금은 볼 수 없는 할 일이에요')).toBeOnTheScreen();

    // When
    await user.press(screen.getByText('뒤로 가기'));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
  });
});
